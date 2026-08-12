import type { IdentifierKind, RequestLanguage, RequestType } from "@/db/schema"

/**
 * Letter generation for the four supported DSGVO request types, in German and
 * English. Pure functions: identifiers arrive already decrypted, the caller
 * (a server action) is responsible for never letting them near a log.
 *
 * All four types share the one-month response deadline of Art. 12(3) DSGVO;
 * the Art. 21 letter additionally states that the objection to direct
 * marketing takes effect immediately and allows no balancing test.
 */

export type TemplateIdentifier = {
  kind: IdentifierKind
  label: string
  value: string
}

export type RenderedRequest = {
  subject: string
  body: string
}

const kindLabels: Record<RequestLanguage, Record<IdentifierKind, string>> = {
  de: { name: "Name", phone: "Telefonnummer", address: "Anschrift", email: "E-Mail-Adresse" },
  en: { name: "Name", phone: "Phone number", address: "Postal address", email: "Email address" },
}

function identifierBlock(identifiers: TemplateIdentifier[], language: RequestLanguage): string {
  return identifiers
    .map((i) => `- ${kindLabels[language][i.kind]} (${i.label}): ${i.value}`)
    .join("\n")
}

const subjects: Record<RequestType, Record<RequestLanguage, string>> = {
  art15: {
    de: "Auskunftsersuchen nach Art. 15 DSGVO",
    en: "Subject access request under Art. 15 GDPR",
  },
  art17: {
    de: "Antrag auf Löschung nach Art. 17 DSGVO",
    en: "Request for erasure under Art. 17 GDPR",
  },
  art21: {
    de: "Widerspruch gegen Direktwerbung nach Art. 21 Abs. 2 DSGVO",
    en: "Objection to direct marketing under Art. 21(2) GDPR",
  },
  art16: {
    de: "Antrag auf Berichtigung nach Art. 16 DSGVO",
    en: "Request for rectification under Art. 16 GDPR",
  },
}

const coreParagraphs: Record<RequestType, Record<RequestLanguage, string>> = {
  art15: {
    de: `hiermit mache ich mein Recht auf Auskunft nach Art. 15 DSGVO geltend. Bitte teilen Sie mir mit, ob Sie mich betreffende personenbezogene Daten verarbeiten, und stellen Sie mir eine vollständige Kopie dieser Daten zur Verfügung (Art. 15 Abs. 3 DSGVO).

Insbesondere bitte ich um Auskunft über:
- alle zu meiner Person gespeicherten Daten und deren Kategorien,
- die Verarbeitungszwecke,
- die Empfänger oder Kategorien von Empfängern, gegenüber denen die Daten offengelegt worden sind oder noch offengelegt werden,
- die geplante Speicherdauer,
- alle verfügbaren Informationen über die Herkunft der Daten (Art. 15 Abs. 1 lit. g DSGVO), soweit die Daten nicht bei mir erhoben wurden.`,
    en: `I hereby exercise my right of access under Art. 15 GDPR. Please confirm whether you process personal data concerning me, and provide me with a complete copy of that data (Art. 15(3) GDPR).

In particular, please disclose:
- all data stored about me and its categories,
- the purposes of processing,
- the recipients or categories of recipients to whom the data has been or will be disclosed,
- the envisaged storage period,
- any available information as to the source of the data (Art. 15(1)(g) GDPR), where it was not collected from me.`,
  },
  art17: {
    de: `hiermit verlange ich die unverzügliche Löschung sämtlicher mich betreffender personenbezogener Daten nach Art. 17 DSGVO. Sofern Sie die Daten öffentlich gemacht haben, sind Sie nach Art. 17 Abs. 2 DSGVO verpflichtet, auch weitere Verantwortliche über mein Löschverlangen zu informieren.

Bitte bestätigen Sie mir die Löschung schriftlich. Sollten Sie sich auf eine Ausnahme nach Art. 17 Abs. 3 DSGVO berufen, benennen Sie diese bitte konkret und begründen Sie sie.`,
    en: `I hereby request the immediate erasure of all personal data concerning me under Art. 17 GDPR. Where you have made the data public, Art. 17(2) GDPR obliges you to inform other controllers of my erasure request.

Please confirm the erasure in writing. If you rely on an exemption under Art. 17(3) GDPR, please name it specifically and state your reasons.`,
  },
  art21: {
    de: `hiermit widerspreche ich nach Art. 21 Abs. 2 DSGVO der Verarbeitung meiner personenbezogenen Daten zum Zwecke der Direktwerbung, einschließlich eines etwaigen Profilings, soweit es mit solcher Direktwerbung in Verbindung steht.

Dieser Widerspruch ist unbedingt: Nach Art. 21 Abs. 3 DSGVO dürfen meine Daten ab sofort nicht mehr für Zwecke der Direktwerbung verarbeitet werden. Eine Interessenabwägung findet nicht statt. Der Widerspruch wirkt unmittelbar und nicht erst nach Ablauf einer Bearbeitungsfrist.`,
    en: `I hereby object under Art. 21(2) GDPR to the processing of my personal data for direct marketing purposes, including any profiling to the extent that it is related to such marketing.

This objection is unconditional: under Art. 21(3) GDPR my data may no longer be processed for direct marketing purposes as of now. No balancing of interests takes place. The objection takes effect immediately, not after a processing period.`,
  },
  art16: {
    de: `hiermit verlange ich nach Art. 16 DSGVO die unverzügliche Berichtigung der mich betreffenden unrichtigen personenbezogenen Daten. Die korrekten Angaben entnehmen Sie bitte der unten stehenden Liste.

Bitte bestätigen Sie mir die Berichtigung schriftlich und teilen Sie diese nach Art. 19 DSGVO auch allen Empfängern mit, denen die unrichtigen Daten offengelegt wurden.`,
    en: `I hereby request the immediate rectification of inaccurate personal data concerning me under Art. 16 GDPR. The correct details are listed below.

Please confirm the rectification in writing and, under Art. 19 GDPR, communicate it to all recipients to whom the inaccurate data was disclosed.`,
  },
}

function deadlineParagraph(type: RequestType, language: RequestLanguage): string {
  if (type === "art21") {
    return language === "de"
      ? "Ich erwarte Ihre Bestätigung ohne schuldhaftes Zögern, spätestens jedoch innerhalb eines Monats (Art. 12 Abs. 3 DSGVO)."
      : "I expect your confirmation without undue delay, and in any event within one month (Art. 12(3) GDPR)."
  }
  return language === "de"
    ? "Nach Art. 12 Abs. 3 DSGVO haben Sie meinem Antrag unverzüglich, spätestens jedoch innerhalb eines Monats nach Eingang, zu entsprechen. Andernfalls behalte ich mir eine Beschwerde bei der zuständigen Aufsichtsbehörde nach Art. 77 DSGVO vor."
    : "Under Art. 12(3) GDPR you must comply with my request without undue delay, and in any event within one month of receipt. Otherwise I reserve the right to lodge a complaint with the competent supervisory authority under Art. 77 GDPR."
}

export function renderRequest(input: {
  type: RequestType
  language: RequestLanguage
  controllerName: string
  identifiers: TemplateIdentifier[]
  details?: string
}): RenderedRequest {
  const { type, language, controllerName, identifiers, details } = input
  const de = language === "de"

  const identifierIntro = de
    ? "Zur Identifikation meiner Person und zur Zuordnung der Daten nenne ich folgende Angaben:"
    : "To identify me and match the data, I provide the following details:"

  const parts = [
    de ? `An: ${controllerName}` : `To: ${controllerName}`,
    "",
    de ? "Sehr geehrte Damen und Herren," : "Dear Sir or Madam,",
    "",
    coreParagraphs[type][language],
    "",
    identifierIntro,
    identifierBlock(identifiers, language),
  ]

  if (details?.trim()) {
    parts.push(
      "",
      de ? `Ergänzende Angaben: ${details.trim()}` : `Additional details: ${details.trim()}`,
    )
  }

  parts.push(
    "",
    deadlineParagraph(type, language),
    "",
    de ? "Mit freundlichen Grüßen" : "Yours faithfully",
  )

  return { subject: subjects[type][language], body: parts.join("\n") }
}

const typeNames: Record<RequestType, string> = {
  art15: "Auskunft (Art. 15 DSGVO)",
  art17: "Löschung (Art. 17 DSGVO)",
  art21: "Widerspruch (Art. 21 DSGVO)",
  art16: "Berichtigung (Art. 16 DSGVO)",
}

/**
 * Complaint draft to the competent supervisory authority — for this operator,
 * LfDI Baden-Württemberg. Draft only; the app never sends anything.
 */
export function renderEscalation(input: {
  controllerName: string
  requestType: RequestType
  sentAt: Date
  deadlineAt: Date
}): RenderedRequest {
  const { controllerName, requestType, sentAt, deadlineAt } = input
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const body = [
    "An: Landesbeauftragter für den Datenschutz und die Informationsfreiheit Baden-Württemberg",
    "Lautenschlagerstraße 20, 70173 Stuttgart",
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    `hiermit lege ich Beschwerde nach Art. 77 DSGVO gegen den Verantwortlichen "${controllerName}" ein.`,
    "",
    `Am ${fmt(sentAt)} habe ich gegenüber dem Verantwortlichen einen Antrag gestellt: ${typeNames[requestType]}. Die Frist des Art. 12 Abs. 3 DSGVO ist am ${fmt(deadlineAt)} abgelaufen, ohne dass der Verantwortliche reagiert oder meinem Antrag entsprochen hat.`,
    "",
    "Ich bitte Sie, den Vorgang zu prüfen und gegenüber dem Verantwortlichen tätig zu werden. Eine Kopie meines ursprünglichen Antrags füge ich bei.",
    "",
    "Mit freundlichen Grüßen",
  ].join("\n")

  return {
    subject: `Beschwerde nach Art. 77 DSGVO gegen ${controllerName}`,
    body,
  }
}
