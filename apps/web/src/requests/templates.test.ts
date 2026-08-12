import { describe, expect, it } from "vitest"
import { requestLanguages, requestTypes } from "../db/schema.ts"
import { renderEscalation, renderRequest, type TemplateIdentifier } from "./templates.ts"

const identifiers: TemplateIdentifier[] = [
  { kind: "name", label: "full name", value: "Erika Mustermann" },
  { kind: "email", label: "legacy", value: "erika@example.org" },
  { kind: "phone", label: "mobile", value: "+49 170 1234567" },
  { kind: "address", label: "previous", value: "Musterstraße 1, 70173 Stuttgart" },
]

describe("renderRequest", () => {
  it("generates every type in every language with all identifiers included", () => {
    for (const type of requestTypes) {
      for (const language of requestLanguages) {
        const { subject, body } = renderRequest({
          type,
          language,
          controllerName: "Acme GmbH",
          identifiers,
        })
        expect(subject.length).toBeGreaterThan(0)
        expect(body).toContain("Acme GmbH")
        for (const i of identifiers) expect(body).toContain(i.value)
      }
    }
  })

  it("cites the right article per type", () => {
    expect(
      renderRequest({ type: "art15", language: "de", controllerName: "X", identifiers }).body,
    ).toContain("Art. 15 DSGVO")
    expect(
      renderRequest({ type: "art17", language: "en", controllerName: "X", identifiers }).body,
    ).toContain("Art. 17 GDPR")
    expect(
      renderRequest({ type: "art16", language: "de", controllerName: "X", identifiers }).body,
    ).toContain("Art. 16 DSGVO")
  })

  it("demands the data source in an Art. 15 request — it is the discovery mechanism", () => {
    const { body } = renderRequest({
      type: "art15",
      language: "en",
      controllerName: "X",
      identifiers,
    })
    expect(body).toMatch(/source of the data/)
  })

  it("states immediate effect and no balancing test for Art. 21", () => {
    const de = renderRequest({ type: "art21", language: "de", controllerName: "X", identifiers })
    expect(de.body).toContain("Interessenabwägung findet nicht statt")
    const en = renderRequest({ type: "art21", language: "en", controllerName: "X", identifiers })
    expect(en.body).toContain("No balancing of interests")
    expect(en.body).toContain("immediately")
  })

  it("names the one-month deadline", () => {
    const { body } = renderRequest({
      type: "art17",
      language: "en",
      controllerName: "X",
      identifiers,
    })
    expect(body).toContain("within one month")
  })

  it("includes free-text details when given", () => {
    const { body } = renderRequest({
      type: "art16",
      language: "de",
      controllerName: "X",
      identifiers,
      details: "Der Nachname ist falsch geschrieben.",
    })
    expect(body).toContain("Der Nachname ist falsch geschrieben.")
  })
})

describe("renderEscalation", () => {
  it("drafts a complaint to LfDI Baden-Württemberg naming controller and dates", () => {
    const { subject, body } = renderEscalation({
      controllerName: "Acme GmbH",
      requestType: "art17",
      sentAt: new Date("2026-01-10T00:00:00Z"),
      deadlineAt: new Date("2026-02-10T00:00:00Z"),
    })
    expect(subject).toContain("Art. 77 DSGVO")
    expect(body).toContain("Baden-Württemberg")
    expect(body).toContain("Acme GmbH")
    expect(body).toContain("2026-01-10")
    expect(body).toContain("2026-02-10")
  })
})
