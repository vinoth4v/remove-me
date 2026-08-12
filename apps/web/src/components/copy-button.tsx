"use client"

import { useState } from "react"

/** Copies prepared text (a letter) so nobody has to select-all in a <pre>. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  )
}
