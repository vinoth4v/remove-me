"use server"

import { revalidatePath } from "next/cache"
import { BLOCK_REASON, blockSender, runBulkUnsubscribe, unsubscribeFromSender } from "./engine.ts"

// Bulk unsubscribe can take up to 50 seconds (50 senders, 1 second apart) —
// above the platform default, within what Vercel Hobby allows per function.
export const maxDuration = 60

export async function unsubscribeAction(senderId: string, _formData: FormData): Promise<void> {
  await unsubscribeFromSender(senderId)
  revalidatePath("/senders")
  revalidatePath("/")
}

export async function blockAction(senderId: string, _formData: FormData): Promise<void> {
  await blockSender(senderId, BLOCK_REASON)
  revalidatePath("/senders")
  revalidatePath("/")
}

export async function runBulkUnsubscribeAction(_formData: FormData): Promise<void> {
  await runBulkUnsubscribe()
  revalidatePath("/senders")
  revalidatePath("/")
}
