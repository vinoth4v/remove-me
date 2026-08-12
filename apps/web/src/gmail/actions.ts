"use server"

import { revalidatePath } from "next/cache"
import { runScan } from "./scan.ts"

// A single scan invocation processes one time-boxed batch (see scan.ts) and
// can still run close to a minute; give it the platform's own ceiling.
export const maxDuration = 60

export async function runScanAction(_formData: FormData): Promise<void> {
  await runScan()
  revalidatePath("/")
  revalidatePath("/senders")
}
