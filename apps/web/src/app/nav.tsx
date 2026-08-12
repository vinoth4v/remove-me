import Link from "next/link"

const links = [
  { href: "/", label: "Home" },
  { href: "/vault", label: "My details" },
  { href: "/exposures", label: "Who has my data" },
  { href: "/requests", label: "My requests" },
  { href: "/registry", label: "Easy wins" },
] as const

export function AppNav({ current }: { current: string }) {
  return (
    <nav aria-label="Sections">
      {links.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
