import { describe, expect, it } from "vitest"
import { deadlineFor, erasureRecheckDue, isOverdue, renewalDue } from "./lifecycle.ts"

describe("deadlineFor", () => {
  it("adds one calendar month", () => {
    expect(deadlineFor(new Date("2026-03-15T09:00:00Z")).toISOString()).toBe(
      "2026-04-15T09:00:00.000Z",
    )
  })

  it("clamps to the end of a shorter month", () => {
    expect(deadlineFor(new Date("2026-01-31T00:00:00Z")).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    )
  })
})

describe("isOverdue", () => {
  const deadline = new Date("2026-07-01T00:00:00Z")

  it("flags a sent request past its deadline", () => {
    expect(isOverdue("sent", deadline, new Date("2026-07-02T00:00:00Z"))).toBe(true)
  })

  it("leaves a request inside its deadline alone", () => {
    expect(isOverdue("sent", deadline, new Date("2026-06-30T00:00:00Z"))).toBe(false)
  })

  it("ignores drafts and answered requests", () => {
    const later = new Date("2026-08-01T00:00:00Z")
    expect(isOverdue("draft", deadline, later)).toBe(false)
    expect(isOverdue("responded", deadline, later)).toBe(false)
    expect(isOverdue("sent", null, later)).toBe(false)
  })
})

describe("erasureRecheckDue", () => {
  const confirmed = new Date("2026-01-01T00:00:00Z")

  it("flags a satisfied Art. 17 confirmed more than six months ago", () => {
    expect(
      erasureRecheckDue("art17", "satisfied", confirmed, new Date("2026-07-02T00:00:00Z")),
    ).toBe(true)
  })

  it("does not flag inside six months", () => {
    expect(
      erasureRecheckDue("art17", "satisfied", confirmed, new Date("2026-06-30T00:00:00Z")),
    ).toBe(false)
  })

  it("only applies to satisfied erasure requests", () => {
    const later = new Date("2027-01-01T00:00:00Z")
    expect(erasureRecheckDue("art15", "satisfied", confirmed, later)).toBe(false)
    expect(erasureRecheckDue("art17", "refused", confirmed, later)).toBe(false)
    expect(erasureRecheckDue("art17", "satisfied", null, later)).toBe(false)
  })
})

describe("renewalDue", () => {
  const acted = new Date("2021-06-01T00:00:00Z")

  it("flags a done item past its interval", () => {
    expect(renewalDue("done", 60, acted, new Date("2026-06-02T00:00:00Z"))).toBe(true)
  })

  it("does not flag inside the interval or without one", () => {
    expect(renewalDue("done", 60, acted, new Date("2026-05-01T00:00:00Z"))).toBe(false)
    expect(renewalDue("done", null, acted, new Date("2030-01-01T00:00:00Z"))).toBe(false)
    expect(renewalDue("open", 60, acted, new Date("2030-01-01T00:00:00Z"))).toBe(false)
  })
})
