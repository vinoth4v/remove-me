import { and, eq, isNotNull, lt } from "drizzle-orm"
import { db } from "@/db/client"
import { recordEvent } from "@/db/events"
import { controller, registryItem, request } from "@/db/schema"
import { erasureRecheckDue, renewalDue } from "@/requests/lifecycle"
import { renderEscalation } from "@/requests/templates"

/**
 * Weekly verification sweep (vercel.json cron, Mondays 06:00 UTC).
 *
 * Exempt from the session gate in proxy.ts, so it must authenticate itself:
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that env var
 * exists on the project. No secret configured means no access at all.
 */
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 })
  }

  const now = new Date()

  // 1. Sent requests past the Art. 12(3) one-month deadline become overdue,
  //    each with a complaint draft to the supervisory authority. Draft only —
  //    the app never sends anything.
  const overdueRows = await db()
    .select({ req: request, controllerName: controller.name })
    .from(request)
    .innerJoin(controller, eq(request.controllerId, controller.id))
    .where(
      and(eq(request.status, "sent"), isNotNull(request.deadlineAt), lt(request.deadlineAt, now)),
    )
  for (const { req: row, controllerName } of overdueRows) {
    if (!row.sentAt || !row.deadlineAt) continue
    const rendered = renderEscalation({
      controllerName,
      requestType: row.type,
      sentAt: row.sentAt,
      deadlineAt: row.deadlineAt,
    })
    await db()
      .update(request)
      .set({ status: "overdue", escalationDraft: `${rendered.subject}\n\n${rendered.body}` })
      .where(eq(request.id, row.id))
  }

  // 2. Erasures confirmed more than six months ago get a re-check flag —
  //    re-listing after deletion is the norm, not the exception.
  const satisfiedErasures = await db()
    .select()
    .from(request)
    .where(
      and(
        eq(request.type, "art17"),
        eq(request.status, "satisfied"),
        eq(request.recheckDue, false),
      ),
    )
  const recheck = satisfiedErasures.filter((row) =>
    erasureRecheckDue(row.type, row.status, row.replyAt, now),
  )
  for (const row of recheck) {
    await db().update(request).set({ recheckDue: true }).where(eq(request.id, row.id))
  }

  // 3. Registry entries past their renewal interval.
  const doneItems = await db().select().from(registryItem).where(eq(registryItem.status, "done"))
  const renewals = doneItems.filter((row) =>
    renewalDue(row.status, row.renewalMonths, row.lastActionAt, now),
  )
  for (const row of renewals) {
    await db()
      .update(registryItem)
      .set({ status: "renewal_due" })
      .where(eq(registryItem.id, row.id))
  }

  const summary = {
    overdue: overdueRows.length,
    recheckDue: recheck.length,
    renewalsDue: renewals.length,
  }
  await recordEvent("cron_verify", "cron", JSON.stringify(summary))
  return Response.json(summary)
}
