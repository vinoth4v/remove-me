"use server"

import { ilike } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db/client"
import { controller, exposure, exposureSources, removabilities } from "@/db/schema"
import { defaultRemovabilityReasons } from "@/requests/labels"

const exposureSchema = z.object({
  companyName: z.string().trim().min(1).max(300),
  contact: z.string().trim().max(500).optional(),
  source: z.enum(exposureSources),
  description: z.string().trim().max(2000).optional(),
  identifierIds: z.array(z.uuid()),
  removability: z.enum(removabilities),
  removabilityReason: z.string().trim().max(1000).optional(),
})

/**
 * One form, two rows: the company (controller) is created on the fly — or
 * reused case-insensitively by name — so a beginner never meets the concept
 * of "adding a controller first". A skipped "why" gets a sensible default
 * per rating so the classifier is never stored without its reason.
 */
export async function addExposureAction(formData: FormData): Promise<void> {
  const parsed = exposureSchema.parse({
    companyName: formData.get("companyName"),
    contact: formData.get("contact") ?? undefined,
    source: formData.get("source"),
    description: formData.get("description") ?? undefined,
    identifierIds: formData.getAll("identifierIds"),
    removability: formData.get("removability"),
    removabilityReason: formData.get("removabilityReason") ?? undefined,
  })

  const [existing] = await db()
    .select()
    .from(controller)
    .where(ilike(controller.name, parsed.companyName))

  let controllerId = existing?.id
  if (!controllerId) {
    const [created] = await db()
      .insert(controller)
      .values({ name: parsed.companyName, contact: parsed.contact || null })
      .returning({ id: controller.id })
    if (!created) throw new Error("insert returned no row")
    controllerId = created.id
  }

  await db()
    .insert(exposure)
    .values({
      controllerId,
      source: parsed.source,
      description: parsed.description || null,
      identifierIds: parsed.identifierIds,
      removability: parsed.removability,
      removabilityReason:
        parsed.removabilityReason || defaultRemovabilityReasons[parsed.removability],
    })
  revalidatePath("/exposures")
  revalidatePath("/requests")
  revalidatePath("/")
}
