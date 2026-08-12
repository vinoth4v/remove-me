import { describe, expect, it } from "vitest"
import { isSafeUnsubscribeUrl, parseFromHeader, parseListUnsubscribe } from "./parse.ts"

describe("parseListUnsubscribe", () => {
  it("extracts https and mailto channels", () => {
    const method = parseListUnsubscribe(
      "<https://news.acme.example/unsub?id=1>, <mailto:unsub@acme.example?subject=stop>",
      null,
    )
    expect(method).toEqual({
      url: "https://news.acme.example/unsub?id=1",
      mailto: "unsub@acme.example",
      oneClick: false,
    })
  })

  it("detects RFC 8058 one-click", () => {
    const method = parseListUnsubscribe(
      "<https://news.acme.example/unsub?id=1>",
      "List-Unsubscribe=One-Click",
    )
    expect(method?.oneClick).toBe(true)
  })

  it("is not one-click when only mailto exists", () => {
    const method = parseListUnsubscribe("<mailto:unsub@acme.example>", "List-Unsubscribe=One-Click")
    expect(method?.oneClick).toBe(false)
    expect(method?.mailto).toBe("unsub@acme.example")
  })

  it("ignores http (non-https) targets and empty headers", () => {
    expect(parseListUnsubscribe("<http://insecure.example/u>", null)).toBeNull()
    expect(parseListUnsubscribe(undefined, null)).toBeNull()
    expect(parseListUnsubscribe("", null)).toBeNull()
  })
})

describe("parseFromHeader", () => {
  it("splits display name and address", () => {
    expect(parseFromHeader('"Acme News" <News@Acme.example>')).toEqual({
      name: "Acme News",
      address: "news@acme.example",
    })
  })

  it("handles bare addresses", () => {
    expect(parseFromHeader("news@acme.example")).toEqual({
      name: null,
      address: "news@acme.example",
    })
  })

  it("rejects garbage", () => {
    expect(parseFromHeader("not an address")).toBeNull()
  })
})

describe("isSafeUnsubscribeUrl", () => {
  it("accepts a public https URL", () => {
    expect(isSafeUnsubscribeUrl("https://news.acme.example/unsub?id=1")).toBe(true)
  })

  it("rejects http, localhost, raw IPs and garbage", () => {
    expect(isSafeUnsubscribeUrl("http://news.acme.example/u")).toBe(false)
    expect(isSafeUnsubscribeUrl("https://localhost/u")).toBe(false)
    expect(isSafeUnsubscribeUrl("https://10.0.0.1/u")).toBe(false)
    expect(isSafeUnsubscribeUrl("https://[::1]/u")).toBe(false)
    expect(isSafeUnsubscribeUrl("not a url")).toBe(false)
  })
})
