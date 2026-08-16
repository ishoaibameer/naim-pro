import { describe, expect, it } from "vitest"

import { InvalidPhoneNumberError, normalizePhone } from "./phone"

describe("normalizePhone", () => {
  it.each([
    "9876543210",
    "09876543210",
    "+919876543210",
    "91 98765 43210",
    "(98765) 43210",
  ])("normalizes %s to canonical Indian E.164", (input) => {
    expect(normalizePhone(input)).toBe("+919876543210")
  })

  it.each([
    "",
    "1234567890",
    "+19876543210",
    "987654321",
    "98765432100",
    "9876543210 ext 4",
  ])("rejects ambiguous or invalid input %s", (input) => {
    expect(() => normalizePhone(input)).toThrow(InvalidPhoneNumberError)
  })
})
