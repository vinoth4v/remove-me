"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db/client"
import { recordEvent } from "@/db/events"
import { identifier, identifierKinds } from "@/db/schema"
import { encryptIdentifier } from "@/vault/crypto"

const addSchema = z.object({
  kind: z.enum(identifierKinds),
  label: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(2000),
})

export async function addIdentifierAction(formData: FormData): Promise<void> {
  const parsed = addSchema.parse({
    kind: formData.get("kind"),
    label: formData.get("label"),
    value: formData.get("value"),
  })

  await db()
    .insert(identifier)
    .values({
      kind: parsed.kind,
      label: parsed.label,
      valueEncrypted: encryptIdentifier(parsed.value),
    })

  // Kind and label only — the value must never reach the audit log.
  await recordEvent("identifier_added", null, `${parsed.kind}: ${parsed.label}`)
  revalidatePath("/vault")
}

export async function deleteIdentifierAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"))
  await db().delete(identifier).where(eq(identifier.id, id))
  await recordEvent("identifier_removed", null, id)
  revalidatePath("/vault")
}
