"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db/client"
import { controller, exposure, exposureSources, removabilities } from "@/db/schema"

const controllerSchema = z.object({
  name: z.string().trim().min(1).max(300),
  contact: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export async function addControllerAction(formData: FormData): Promise<void> {
  const parsed = controllerSchema.parse({
    name: formData.get("name"),
    contact: formData.get("contact") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  })
  await db()
    .insert(controller)
    .values({
      name: parsed.name,
      contact: parsed.contact || null,
      notes: parsed.notes || null,
    })
  revalidatePath("/exposures")
  revalidatePath("/requests")
}

const exposureSchema = z.object({
  controllerId: z.uuid(),
  source: z.enum(exposureSources),
  description: z.string().trim().max(2000).optional(),
  identifierIds: z.array(z.uuid()),
  removability: z.enum(removabilities),
  removabilityReason: z.string().trim().min(1).max(1000),
})

export async function addExposureAction(formData: FormData): Promise<void> {
  const parsed = exposureSchema.parse({
    controllerId: formData.get("controllerId"),
    source: formData.get("source"),
    description: formData.get("description") ?? undefined,
    identifierIds: formData.getAll("identifierIds"),
    removability: formData.get("removability"),
    removabilityReason: formData.get("removabilityReason"),
  })
  await db()
    .insert(exposure)
    .values({
      controllerId: parsed.controllerId,
      source: parsed.source,
      description: parsed.description || null,
      identifierIds: parsed.identifierIds,
      removability: parsed.removability,
      removabilityReason: parsed.removabilityReason,
    })
  revalidatePath("/exposures")
}
