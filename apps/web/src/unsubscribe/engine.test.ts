import { describe, expect, it } from "vitest"
import type { SenderRow } from "@/db/schema"
import { decideUnsubscribeMethod } from "./engine.ts"

function sender(overrides: Partial<SenderRow> = {}): SenderRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    domain: "example.com",
    sampleAddress: "news@example.com",
    messageCount: 5,
    firstSeen: new Date("2026-01-01"),
    lastSeen: new Date("2026-03-01"),
    hasListUnsubscribe: true,
    oneClickSupported: false,
    unsubscribeUrl: null,
    unsubscribeMailto: null,
    authAligned: true,
    classification: "legitimate",
    status: "active",
    updatedAt: new Date("2026-03-01"),
    ...overrides,
  }
}

describe("decideUnsubscribeMethod", () => {
  it("refuses a non-legitimate sender regardless of what unsubscribe fields it has", () => {
    const decision = decideUnsubscribeMethod(
      sender({ classification: "suspicious", oneClickSupported: true, unsubscribeUrl: "https://x" }),
    )
    expect(decision.method).toBeNull()
  })

  it("prefers one-click when the sender supports it", () => {
    const decision = decideUnsubscribeMethod(
      sender({ oneClickSupported: true, unsubscribeUrl: "https://example.com/unsub" }),
    )
    expect(decision).toEqual({ method: "one_click_post", url: "https://example.com/unsub" })
  })

  it("falls back to a manual link when there is a URL but no one-click support", () => {
    const decision = decideUnsubscribeMethod(
      sender({ oneClickSupported: false, unsubscribeUrl: "https://example.com/unsub" }),
    )
    expect(decision).toEqual({ method: "manual_link", url: "https://example.com/unsub" })
  })

  it("falls back to mailto when there is only a mailto address", () => {
    const decision = decideUnsubscribeMethod(sender({ unsubscribeMailto: "unsub@example.com" }))
    expect(decision).toEqual({ method: "mailto", address: "unsub@example.com" })
  })

  it("has no method when a legitimate sender somehow has neither", () => {
    const decision = decideUnsubscribeMethod(sender())
    expect(decision.method).toBeNull()
  })
})
