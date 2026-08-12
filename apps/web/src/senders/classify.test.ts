import { describe, expect, it } from "vitest"
import { classifySender } from "./classify.ts"

const DAY = 24 * 60 * 60 * 1000

describe("classifySender", () => {
  it("is legitimate with List-Unsubscribe, aligned auth, 3+ messages over 30+ days", () => {
    expect(
      classifySender({
        hasListUnsubscribe: true,
        authAligned: true,
        messageCount: 3,
        firstSeen: new Date("2026-01-01"),
        lastSeen: new Date("2026-02-05"),
      }),
    ).toBe("legitimate")
  })

  it("is suspicious with no List-Unsubscribe header, regardless of everything else", () => {
    expect(
      classifySender({
        hasListUnsubscribe: false,
        authAligned: true,
        messageCount: 10,
        firstSeen: new Date("2026-01-01"),
        lastSeen: new Date("2026-03-01"),
      }),
    ).toBe("suspicious")
  })

  it("is suspicious on authentication failure even with a List-Unsubscribe header", () => {
    expect(
      classifySender({
        hasListUnsubscribe: true,
        authAligned: false,
        messageCount: 10,
        firstSeen: new Date("2026-01-01"),
        lastSeen: new Date("2026-03-01"),
      }),
    ).toBe("suspicious")
  })

  it("is suspicious for a first-and-only message even when everything else qualifies", () => {
    expect(
      classifySender({
        hasListUnsubscribe: true,
        authAligned: true,
        messageCount: 1,
        firstSeen: new Date("2026-01-01"),
        lastSeen: new Date("2026-01-01"),
      }),
    ).toBe("suspicious")
  })

  it("is unknown when it qualifies except for the 3-message threshold", () => {
    expect(
      classifySender({
        hasListUnsubscribe: true,
        authAligned: true,
        messageCount: 2,
        firstSeen: new Date("2026-01-01"),
        lastSeen: new Date("2026-03-01"),
      }),
    ).toBe("unknown")
  })

  it("is unknown when it qualifies except for the 30-day span", () => {
    expect(
      classifySender({
        hasListUnsubscribe: true,
        authAligned: true,
        messageCount: 5,
        firstSeen: new Date("2026-01-01"),
        lastSeen: new Date(new Date("2026-01-01").getTime() + 10 * DAY),
      }),
    ).toBe("unknown")
  })

  it("is legitimate at exactly the 3-message, 30-day boundary", () => {
    const firstSeen = new Date("2026-01-01")
    expect(
      classifySender({
        hasListUnsubscribe: true,
        authAligned: true,
        messageCount: 3,
        firstSeen,
        lastSeen: new Date(firstSeen.getTime() + 30 * DAY),
      }),
    ).toBe("legitimate")
  })
})
