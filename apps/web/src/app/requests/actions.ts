"use server"

import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { db } from "@/db/client"
import { recordEvent } from "@/db/events"
import {
  controller,
  exposure,
  identifier,
  request,
  requestLanguages,
  requestTypes,
} from "@/db/schema"
import { deadlineFor } from "@/requests/lifecycle"
import { renderEscalation, renderRequest, type TemplateIdentifier } from "@/requests/templates"
import { decryptIdentifier } from "@/vault/crypto"

async function decryptedIdentifiers(ids: string[]): Promise<TemplateIdentifier[]> {
  if (ids.length === 0) return []
  const rows = await db().select().from(identifier).where(inArray(identifier.id, ids))
  return rows.map((row) => ({
    kind: row.kind,
    label: row.label,
    value: decryptIdentifier(row.valueEncrypted),
  }))
}

const createSchema = z.object({
  controllerId: z.uuid(),
  exposureId: z.uuid().optional(),
  type: z.enum(requestTypes),
  language: z.enum(requestLanguages),
  identifierIds: z.array(z.uuid()).min(1),
  details: z.string().trim().max(4000).optional(),
})

export async function createRequestAction(formData: FormData): Promise<void> {
  const parsed = createSchema.parse({
    controllerId: formData.get("controllerId"),
    exposureId: formData.get("exposureId") || undefined,
    type: formData.get("type"),
    language: formData.get("language"),
    identifierIds: formData.getAll("identifierIds"),
    details: formData.get("details") ?? undefined,
  })

  // The permanence classifier is a hard gate, not a UI hint: an exposure
  // under an Art. 17(3) exemption never gets a request, however the form
  // was submitted.
  if (parsed.exposureId) {
    const [linked] = await db().select().from(exposure).where(eq(exposure.id, parsed.exposureId))
    if (!linked) redirect("/requests?error=exposure_missing")
    if (linked.removability === "permanent") redirect("/requests?error=permanent")
  }

  const [target] = await db()
    .select()
    .from(controller)
    .where(eq(controller.id, parsed.controllerId))
  if (!target) redirect("/requests?error=controller_missing")

  const rendered = renderRequest({
    type: parsed.type,
    language: parsed.language,
    controllerName: target.name,
    identifiers: await decryptedIdentifiers(parsed.identifierIds),
    details: parsed.details,
  })

  const [created] = await db()
    .insert(request)
    .values({
      controllerId: parsed.controllerId,
      exposureId: parsed.exposureId ?? null,
      type: parsed.type,
      language: parsed.language,
      identifierIds: parsed.identifierIds,
      body: `${rendered.subject}\n\n${rendered.body}`,
    })
    .returning({ id: request.id })
  if (!created) throw new Error("insert returned no row")

  await recordEvent("request_created", null, `${parsed.type} → ${target.name}`)
  redirect(`/requests/${created.id}`)
}

export async function markSentAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"))
  const now = new Date()
  await db()
    .update(request)
    .set({ status: "sent", sentAt: now, deadlineAt: deadlineFor(now) })
    .where(eq(request.id, id))
  await recordEvent("request_sent", null, id)
  revalidatePath(`/requests/${id}`)
  revalidatePath("/requests")
}

const replySchema = z.object({
  id: z.uuid(),
  replyText: z.string().trim().min(1).max(20000),
  replyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function logReplyAction(formData: FormData): Promise<void> {
  const parsed = replySchema.parse({
    id: formData.get("id"),
    replyText: formData.get("replyText"),
    replyDate: formData.get("replyDate"),
  })
  await db()
    .update(request)
    .set({
      status: "responded",
      replyText: parsed.replyText,
      replyAt: new Date(`${parsed.replyDate}T00:00:00Z`),
    })
    .where(eq(request.id, parsed.id))
  await recordEvent("reply_logged", null, parsed.id)
  revalidatePath(`/requests/${parsed.id}`)
  revalidatePath("/requests")
}

const resolveSchema = z.object({
  id: z.uuid(),
  outcome: z.enum(["satisfied", "refused"]),
})

export async function resolveRequestAction(formData: FormData): Promise<void> {
  const parsed = resolveSchema.parse({
    id: formData.get("id"),
    outcome: formData.get("outcome"),
  })
  await db().update(request).set({ status: parsed.outcome }).where(eq(request.id, parsed.id))
  await recordEvent("request_resolved", null, `${parsed.id}: ${parsed.outcome}`)
  revalidatePath(`/requests/${parsed.id}`)
  revalidatePath("/requests")
}

/**
 * The Art. 15 → Art. 17 handoff: a logged Auskunft reply prompts a prefilled
 * erasure draft against the same controller with the same identifiers.
 */
export async function createFollowUpAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"))
  const [source] = await db()
    .select({ req: request, controllerName: controller.name })
    .from(request)
    .innerJoin(controller, eq(request.controllerId, controller.id))
    .where(eq(request.id, id))
  if (source?.req.type !== "art15") redirect("/requests?error=not_art15")

  const rendered = renderRequest({
    type: "art17",
    language: source.req.language,
    controllerName: source.controllerName,
    identifiers: await decryptedIdentifiers(source.req.identifierIds),
  })

  const [created] = await db()
    .insert(request)
    .values({
      controllerId: source.req.controllerId,
      exposureId: source.req.exposureId,
      type: "art17",
      language: source.req.language,
      identifierIds: source.req.identifierIds,
      body: `${rendered.subject}\n\n${rendered.body}`,
      followUpOfId: source.req.id,
    })
    .returning({ id: request.id })
  if (!created) throw new Error("insert returned no row")

  await recordEvent("request_created", null, `art17 follow-up of ${id}`)
  redirect(`/requests/${created.id}`)
}

/** Fill the escalation draft for an overdue request ahead of the weekly cron. */
export async function generateEscalationAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"))
  const [row] = await db()
    .select({ req: request, controllerName: controller.name })
    .from(request)
    .innerJoin(controller, eq(request.controllerId, controller.id))
    .where(eq(request.id, id))
  if (row?.req.status !== "overdue" || !row.req.sentAt || !row.req.deadlineAt) {
    redirect(`/requests/${id}`)
  }

  const rendered = renderEscalation({
    controllerName: row.controllerName,
    requestType: row.req.type,
    sentAt: row.req.sentAt,
    deadlineAt: row.req.deadlineAt,
  })
  await db()
    .update(request)
    .set({ escalationDraft: `${rendered.subject}\n\n${rendered.body}` })
    .where(eq(request.id, id))
  revalidatePath(`/requests/${id}`)
}
