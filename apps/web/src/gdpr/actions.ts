"use server"

import { revalidatePath } from "next/cache"
import type { GdprArticle, GdprLanguage } from "@/db/schema"
import { createGdprRequest, markGdprRequestResponded, markGdprRequestSent } from "./tracker.ts"

export async function createGdprRequestAction(formData: FormData): Promise<void> {
  const senderId = String(formData.get("senderId") ?? "") || null
  const controllerName = String(formData.get("controllerName") ?? "").trim()
  const article = String(formData.get("article") ?? "")
  const language = String(formData.get("language") ?? "")

  if (!controllerName) throw new Error("controller name is required")
  if (article !== "art17" && article !== "art21") throw new Error("invalid article")
  if (language !== "de" && language !== "en") throw new Error("invalid language")

  await createGdprRequest({
    senderId,
    controllerName,
    article: article as GdprArticle,
    language: language as GdprLanguage,
  })
  revalidatePath("/requests")
}

export async function markSentAction(requestId: string, _formData: FormData): Promise<void> {
  await markGdprRequestSent(requestId)
  revalidatePath("/requests")
}

export async function markRespondedAction(requestId: string, _formData: FormData): Promise<void> {
  await markGdprRequestResponded(requestId)
  revalidatePath("/requests")
}
