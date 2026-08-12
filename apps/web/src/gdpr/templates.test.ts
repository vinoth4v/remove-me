import { describe, expect, it } from "vitest"
import { generateGdprEmail } from "./templates.ts"

const date = new Date("2026-08-12T00:00:00Z")

describe("generateGdprEmail", () => {
  it("cites Article 17 and names the controller and identifier for an erasure request", () => {
    const text = generateGdprEmail({
      article: "art17",
      language: "en",
      controllerName: "Example Corp",
      myEmail: "me@example.com",
      date,
    })

    expect(text).toContain("Article 17")
    expect(text).toContain("Example Corp")
    expect(text).toContain("me@example.com")
    expect(text).toContain("one month")
    expect(text).toContain("2026-08-12")
  })

  it("cites Article 21 for an objection to direct marketing", () => {
    const text = generateGdprEmail({
      article: "art21",
      language: "en",
      controllerName: "Example Corp",
      myEmail: "me@example.com",
      date,
    })

    expect(text).toContain("Article 21")
    expect(text).toContain("direct marketing")
  })

  it("renders German for the erasure request, citing Artikel 17", () => {
    const text = generateGdprEmail({
      article: "art17",
      language: "de",
      controllerName: "Beispiel GmbH",
      myEmail: "me@example.com",
      date,
    })

    expect(text).toContain("Artikel 17")
    expect(text).toContain("DSGVO")
    expect(text).toContain("Beispiel GmbH")
    expect(text).toContain("Löschung")
  })

  it("renders German for the objection request, citing Artikel 21", () => {
    const text = generateGdprEmail({
      article: "art21",
      language: "de",
      controllerName: "Beispiel GmbH",
      myEmail: "me@example.com",
      date,
    })

    expect(text).toContain("Artikel 21")
    expect(text).toContain("Direktwerbung")
  })
})
