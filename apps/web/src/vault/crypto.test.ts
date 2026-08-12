import { randomBytes } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { decryptIdentifier, encryptIdentifier, resetKeyCache } from "./crypto.ts"

const KEY = randomBytes(32).toString("base64")

describe("vault crypto", () => {
  beforeEach(() => {
    process.env.IDENTITY_ENCRYPTION_KEY = KEY
    resetKeyCache()
  })

  afterEach(() => {
    delete process.env.IDENTITY_ENCRYPTION_KEY
    resetKeyCache()
  })

  it("round-trips a value", () => {
    const stored = encryptIdentifier("Max Mustermann")
    expect(decryptIdentifier(stored)).toBe("Max Mustermann")
  })

  it("never stores the plaintext", () => {
    const stored = encryptIdentifier("+49 170 1234567")
    expect(stored).not.toContain("1234567")
    expect(stored.startsWith("v1.")).toBe(true)
  })

  it("uses a fresh IV per encryption", () => {
    expect(encryptIdentifier("same")).not.toBe(encryptIdentifier("same"))
  })

  it("refuses a missing key with an error naming it", () => {
    delete process.env.IDENTITY_ENCRYPTION_KEY
    resetKeyCache()
    expect(() => encryptIdentifier("x")).toThrow(/IDENTITY_ENCRYPTION_KEY/)
  })

  it("refuses a key that is not 32 bytes", () => {
    process.env.IDENTITY_ENCRYPTION_KEY = Buffer.from("short").toString("base64")
    resetKeyCache()
    expect(() => encryptIdentifier("x")).toThrow(/32 bytes/)
  })

  it("fails decryption under the wrong key without echoing contents", () => {
    const stored = encryptIdentifier("Musterstraße 1, 70173 Stuttgart")
    process.env.IDENTITY_ENCRYPTION_KEY = randomBytes(32).toString("base64")
    resetKeyCache()
    expect(() => decryptIdentifier(stored)).toThrow(/could not be decrypted/)
  })

  it("rejects a malformed stored value", () => {
    expect(() => decryptIdentifier("not-encrypted")).toThrow(/expected encrypted format/)
  })
})
