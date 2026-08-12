import Link from "next/link"
import type { ReactNode } from "react"
import { signOutAction } from "@/app/actions.ts"

const LINKS = [
  { href: "/", label: "Exposure" },
  { href: "/senders", label: "Senders" },
  { href: "/breaches", label: "Breaches" },
  { href: "/requests", label: "Requests" },
] as const

/**
 * The shell every screen shares: wordmark, the four-item nav, sign out.
 * Not in the login page's tree — this layout only wraps the route group the
 * operator gate already protects.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <span className="app-wordmark">Remove Me</span>
        <nav className="app-nav">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <form action={signOutAction} className="inline">
          <button type="submit" className="button-quiet">
            Sign out
          </button>
        </form>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
