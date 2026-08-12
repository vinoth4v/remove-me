import type { GdprArticle, GdprLanguage } from "@/db/schema"

export type GdprTemplateInput = {
  article: GdprArticle
  language: GdprLanguage
  controllerName: string
  myEmail: string
  /** Injectable for tests; defaults to today. */
  date?: Date
}

type TemplateVars = { controllerName: string; myEmail: string; date: string }

const art17En = ({ controllerName, myEmail, date }: TemplateVars) => `Subject: Request for Erasure under Article 17 GDPR

To ${controllerName},

I am writing to request the erasure of my personal data that you hold, in accordance with Article 17 of the General Data Protection Regulation (GDPR).

My email address, ${myEmail}, is the identifier under which you hold my personal data.

Please confirm within one month of the date of this request:
1. That all personal data associated with this email address has been erased from your systems and those of any processors acting on your behalf; and
2. Any exceptions under Article 17(3) GDPR you are relying on to retain any of my data.

If you require further information to locate my data, please contact me at the email address above.

Sincerely,
${myEmail}

Date: ${date}`

const art17De = ({ controllerName, myEmail, date }: TemplateVars) => `Betreff: Antrag auf Löschung gemäß Artikel 17 DSGVO

Sehr geehrte Damen und Herren von ${controllerName},

hiermit beantrage ich gemäß Artikel 17 der Datenschutz-Grundverordnung (DSGVO) die Löschung meiner personenbezogenen Daten, die Sie über mich gespeichert haben.

Meine E-Mail-Adresse, ${myEmail}, dient als Kennung, unter der Sie meine personenbezogenen Daten verarbeiten.

Bitte bestätigen Sie mir innerhalb eines Monats ab dem Datum dieses Schreibens:
1. dass alle mit dieser E-Mail-Adresse verknüpften personenbezogenen Daten aus Ihren Systemen sowie denen etwaiger von Ihnen beauftragter Auftragsverarbeiter gelöscht wurden; und
2. auf welche Ausnahmen nach Artikel 17 Abs. 3 DSGVO Sie sich gegebenenfalls berufen, um Daten von mir weiterhin zu speichern.

Für Rückfragen erreichen Sie mich unter der oben genannten E-Mail-Adresse.

Mit freundlichen Grüßen
${myEmail}

Datum: ${date}`

const art21En = ({ controllerName, myEmail, date }: TemplateVars) => `Subject: Objection to Processing for Direct Marketing under Article 21 GDPR

To ${controllerName},

In accordance with Article 21(2) of the General Data Protection Regulation (GDPR), I object to the processing of my personal data for direct marketing purposes, including any profiling related to such marketing.

My email address, ${myEmail}, is the identifier under which you hold my personal data.

Under Article 21(3) GDPR, you must stop processing my personal data for direct marketing purposes as soon as you receive this objection. Please confirm within one month of the date of this request that this has been done.

If you require further information to locate my data, please contact me at the email address above.

Sincerely,
${myEmail}

Date: ${date}`

const art21De = ({ controllerName, myEmail, date }: TemplateVars) => `Betreff: Widerspruch gegen die Verarbeitung zu Zwecken der Direktwerbung gemäß Artikel 21 DSGVO

Sehr geehrte Damen und Herren von ${controllerName},

gemäß Artikel 21 Abs. 2 DSGVO widerspreche ich hiermit der Verarbeitung meiner personenbezogenen Daten zu Zwecken der Direktwerbung, einschließlich des mit einer solchen Direktwerbung in Verbindung stehenden Profilings.

Meine E-Mail-Adresse, ${myEmail}, dient als Kennung, unter der Sie meine personenbezogenen Daten verarbeiten.

Gemäß Artikel 21 Abs. 3 DSGVO dürfen meine personenbezogenen Daten ab Erhalt dieses Widerspruchs nicht mehr für Zwecke der Direktwerbung verarbeitet werden. Bitte bestätigen Sie mir innerhalb eines Monats ab dem Datum dieses Schreibens, dass dies umgesetzt wurde.

Für Rückfragen erreichen Sie mich unter der oben genannten E-Mail-Adresse.

Mit freundlichen Grüßen
${myEmail}

Datum: ${date}`

const TEMPLATES: Record<GdprArticle, Record<GdprLanguage, (vars: TemplateVars) => string>> = {
  art17: { en: art17En, de: art17De },
  art21: { en: art21En, de: art21De },
}

/**
 * Renders one of the two GDPR templates the brief specifies. The result is
 * stored on the request row rather than regenerated on every read, so a
 * request's wording is frozen the moment it is created.
 */
export function generateGdprEmail(input: GdprTemplateInput): string {
  const date = (input.date ?? new Date()).toISOString().slice(0, 10)
  const render = TEMPLATES[input.article][input.language]
  return render({ controllerName: input.controllerName, myEmail: input.myEmail, date })
}
