import { describe, expect, it } from "vitest"
import {
  isAuthAligned,
  parseFromAddress,
  parseListUnsubscribe,
  supportsOneClick,
} from "./headers.ts"

describe("parseFromAddress", () => {
  it("extracts the address and domain from a display-name form", () => {
    expect(parseFromAddress('"Newsletter" <news@Example.COM>')).toEqual({
      address: "news@example.com",
      domain: "example.com",
    })
  })

  it("extracts from a bare address", () => {
    expect(parseFromAddress("offers@example.com")).toEqual({
      address: "offers@example.com",
      domain: "example.com",
    })
  })

  it("collapses different local parts on the same domain to that domain", () => {
    expect(parseFromAddress("news@example.com")?.domain).toBe("example.com")
    expect(parseFromAddress("offers@example.com")?.domain).toBe("example.com")
  })

  it("returns null for a header with no @", () => {
    expect(parseFromAddress("not an address")).toBeNull()
  })
})

describe("parseListUnsubscribe", () => {
  it("finds both an https link and a mailto address", () => {
    expect(
      parseListUnsubscribe("<https://example.com/unsub?id=1>, <mailto:unsub@example.com>"),
    ).toEqual({ url: "https://example.com/unsub?id=1", mailto: "unsub@example.com" })
  })

  it("finds an https-only header", () => {
    expect(parseListUnsubscribe("<https://example.com/unsub>")).toEqual({
      url: "https://example.com/unsub",
      mailto: null,
    })
  })

  it("finds a mailto-only header", () => {
    expect(parseListUnsubscribe("<mailto:unsub@example.com>")).toEqual({
      url: null,
      mailto: "unsub@example.com",
    })
  })

  it("returns both null for an empty header", () => {
    expect(parseListUnsubscribe("")).toEqual({ url: null, mailto: null })
  })
})

describe("supportsOneClick", () => {
  it("recognises the RFC 8058 value", () => {
    expect(supportsOneClick("List-Unsubscribe=One-Click")).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(supportsOneClick("list-unsubscribe=one-click")).toBe(true)
  })

  it("is false when the header is absent", () => {
    expect(supportsOneClick(undefined)).toBe(false)
  })
})

describe("isAuthAligned", () => {
  it("passes on dmarc=pass", () => {
    expect(isAuthAligned("mx.google.com; dmarc=pass (p=REJECT) header.from=example.com")).toBe(
      true,
    )
  })

  it("passes on spf=pass even without dmarc", () => {
    expect(isAuthAligned("mx.google.com; spf=pass smtp.mailfrom=example.com")).toBe(true)
  })

  it("fails on dmarc=fail with no spf pass", () => {
    expect(isAuthAligned("mx.google.com; dmarc=fail; spf=fail")).toBe(false)
  })

  it("fails when the header is absent", () => {
    expect(isAuthAligned(undefined)).toBe(false)
  })
})
