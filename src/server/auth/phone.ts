const INDIA_COUNTRY_CODE = "91"
const INDIAN_MOBILE_PATTERN = /^[6-9][0-9]{9}$/
const FRIENDLY_PHONE_PATTERN = /^\+?[0-9\s()-]+$/

export class InvalidPhoneNumberError extends Error {
  constructor() {
    super("Invalid Indian mobile phone number.")
    this.name = "InvalidPhoneNumberError"
  }
}

export function normalizePhone(input: string): string {
  const trimmed = input.trim()

  if (!trimmed || !FRIENDLY_PHONE_PATTERN.test(trimmed)) {
    throw new InvalidPhoneNumberError()
  }

  const digits = trimmed.replace(/[^0-9]/g, "")
  let nationalNumber: string

  if (trimmed.startsWith("+")) {
    if (!digits.startsWith(INDIA_COUNTRY_CODE) || digits.length !== 12) {
      throw new InvalidPhoneNumberError()
    }
    nationalNumber = digits.slice(2)
  } else if (digits.length === 10) {
    nationalNumber = digits
  } else if (digits.length === 11 && digits.startsWith("0")) {
    nationalNumber = digits.slice(1)
  } else if (digits.length === 12 && digits.startsWith(INDIA_COUNTRY_CODE)) {
    nationalNumber = digits.slice(2)
  } else {
    throw new InvalidPhoneNumberError()
  }

  if (!INDIAN_MOBILE_PATTERN.test(nationalNumber)) {
    throw new InvalidPhoneNumberError()
  }

  return `+${INDIA_COUNTRY_CODE}${nationalNumber}`
}
