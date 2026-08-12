import { eq } from "drizzle-orm"
import Link from "next/link"
import { signOutAction } from "@/app/actions"
import { AppNav } from "@/app/nav"
import { auth } from "@/auth"
import { db } from "@/db/client"
import { controller, exposure, identifier, registryItem, request } from "@/db/schema"
import { plainTypeNames } from "@/requests/labels"

// Reads the session cookie and the database, so there is nothing to prerender.
export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await auth()

  const [identifiers, exposures, requestRows, registryRows] = await Promise.all([
    db().select({ id: identifier.id }).from(identifier),
    db().select({ id: exposure.id }).from(exposure),
    db()
      .select({ req: request, controllerName: controller.name })
      .from(request)
      .innerJoin(controller, eq(request.controllerId, controller.id)),
    db().select().from(registryItem),
  ])

  const steps = [
    {
      done: identifiers.length > 0,
      title: "Add your details",
      text: "Tell the app which name, email, phone and address it should get removed. Stored encrypted — only you can see them.",
      href: "/vault",
      action: "Add my details",
    },
    {
      done: registryRows.some((r) => r.status !== "open"),
      title: "Do the easy wins",
      text: "Six free German opt-out lists stop most advertising and directory listings. Each takes a few minutes.",
      href: "/registry",
      action: "Show me the easy wins",
    },
    {
      done: exposures.length > 0,
      title: "Write down who has your data",
      text: "Every company, directory or website where your data shows up gets an entry, so nothing is forgotten.",
      href: "/exposures",
      action: "Add a company",
    },
    {
      done: requestRows.length > 0,
      title: "Send your first request",
      text: "The app writes the legal letter for you — you only copy it into an email and send it.",
      href: "/requests",
      action: "Write a letter",
    },
  ]

  const attention: { text: string; href: string }[] = []
  for (const { req, controllerName } of requestRows) {
    if (req.status === "overdue") {
      attention.push({
        text: `${controllerName} missed the legal deadline for "${plainTypeNames[req.type]}". A free complaint letter to the privacy authority is ready.`,
        href: `/requests/${req.id}`,
      })
    } else if (req.status === "responded") {
      attention.push({
        text: `${controllerName} answered — tell the app whether they actually did what you asked.`,
        href: `/requests/${req.id}`,
      })
    } else if (req.recheckDue) {
      attention.push({
        text: `${controllerName} confirmed deletion over six months ago — worth checking whether your data is back.`,
        href: `/requests/${req.id}`,
      })
    }
  }
  for (const row of registryRows) {
    if (row.status === "renewal_due") {
      attention.push({
        text: `"${row.name}" needs doing again — its entry has expired.`,
        href: "/registry",
      })
    }
  }

  const waiting = requestRows.filter((r) => r.req.status === "sent")

  return (
    <main>
      <AppNav current="/" />
      <h1>Remove Me</h1>
      <p className="muted">
        Hello, <strong>{session?.user?.email ?? "there"}</strong>. This app helps you get your
        personal data off the internet — step by step, no legal knowledge needed. It never sends
        anything by itself: you always click send.
      </p>

      {attention.length > 0 ? (
        <section>
          <h2>Needs your attention</h2>
          {attention.map((item) => (
            <p key={item.href + item.text} role="alert">
              {item.text} <Link href={item.href}>Take a look</Link>
            </p>
          ))}
        </section>
      ) : null}

      <h2>Your plan</h2>
      <ol className="steps">
        {steps.map((step) => (
          <li key={step.href} className={step.done ? "step-done" : undefined}>
            <strong>
              {step.done ? "✓ " : ""}
              {step.title}
            </strong>
            <br />
            <span className="muted">{step.text}</span>
            <br />
            <Link href={step.href}>{step.done ? "Review" : step.action} →</Link>
          </li>
        ))}
      </ol>

      {waiting.length > 0 ? (
        <p className="muted">
          Currently waiting for answers from{" "}
          {waiting.map(({ controllerName }) => controllerName).join(", ")} — the app checks the
          deadlines for you every week.
        </p>
      ) : null}

      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  )
}
