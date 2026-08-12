import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * Encryption at rest for vault identifiers — AES-256-GCM, one random IV per
 * value, key from IDENTITY_ENCRYPTION_KEY.
 *
 * Read lazily (never at module scope) so `next build` works without the key,
 * and read directly rather than through env() so a vault operation can fail
 * with an error naming exactly this key — same pattern as kompass.ts.
 *
 * Error messages here must never contain the plaintext, the ciphertext, or
 * the key: the vault is the crown jewels, and an error trace is a log line.
 */

const VERSION = "v1"

let cachedKey: Buffer | undefined

function key(): Buffer {
  if (cachedKey) return cachedKey
  const raw = process.env.IDENTITY_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "IDENTITY_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    )
  }
  const decoded = Buffer.from(raw, "base64")
  if (decoded.length !== 32) {
    throw new Error("IDENTITY_ENCRYPTION_KEY must be the base64 encoding of exactly 32 bytes")
  }
  cachedKey = decoded
  return cachedKey
}

/** For tests only: forget the cached key so a new env value takes effect. */
export function resetKeyCache(): void {
  cachedKey = undefined
}

export function encryptIdentifier(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".")
}

export function decryptIdentifier(stored: string): string {
  const [version, iv, tag, ciphertext] = stored.split(".")
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("stored identifier is not in the expected encrypted format")
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"))
    decipher.setAuthTag(Buffer.from(tag, "base64"))
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    // Deliberately swallow the cause: GCM auth failures echo buffer contents.
    throw new Error("identifier could not be decrypted — wrong key or corrupted value")
  }
}
