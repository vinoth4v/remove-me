"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db/client"
import { recordEvent } from "@/db/events"
import { registryItem } from "@/db/schema"

export async function markRegistryDoneAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"))
  await db()
    .update(registryItem)
    .set({ status: "done", lastActionAt: new Date() })
    .where(eq(registryItem.id, id))
  await recordEvent("registry_action", null, id)
  revalidatePath("/registry")
}

export async function reopenRegistryAction(formData: FormData): Promise<void> {
  const id = z.uuid().parse(formData.get("id"))
  await db().update(registryItem).set({ status: "open" }).where(eq(registryItem.id, id))
  revalidatePath("/registry")
}
