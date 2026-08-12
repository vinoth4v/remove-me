import Link from "next/link"

const links = [
  { href: "/", label: "Overview" },
  { href: "/vault", label: "Vault" },
  { href: "/exposures", label: "Exposures" },
  { href: "/requests", label: "Requests" },
  { href: "/registry", label: "Registry" },
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
