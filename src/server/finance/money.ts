import {
  formatScaledDecimal,
  parseExactDecimal,
} from "@/server/operations/decimal"

export type MoneyCents = bigint

export function parseMoney(value: string, positive = false): MoneyCents {
  return parseExactDecimal(value, {
    scale: 2,
    integerDigits: 14,
    positive,
  })
}

export function normalizeMoney(value: string, positive = false): string {
  return formatMoney(parseMoney(value, positive))
}

export function formatMoney(value: MoneyCents): string {
  return formatScaledDecimal(value, 2)
}

export function calculateMaterialValue(
  weightMt: string,
  ratePerMt: string
): string {
  const weightMilli = parseExactDecimal(weightMt, {
    scale: 3,
    integerDigits: 9,
  })
  const rateCents = parseMoney(ratePerMt)
  const numerator = weightMilli * rateCents
  const roundedCents = (numerator + 500n) / 1000n
  return formatMoney(roundedCents)
}

export function calculateRateFromAmount(
  amount: string,
  weightMt: string
): string {
  const amountCents = parseMoney(amount)
  const weightMilli = parseExactDecimal(weightMt, {
    scale: 3,
    integerDigits: 9,
    positive: true,
  })
  const rateCents = (amountCents * 1000n + weightMilli / 2n) / weightMilli
  return formatMoney(rateCents)
}

export function sumMoney(values: readonly string[]): string {
  return formatMoney(
    values.reduce((total, value) => total + parseMoney(value), 0n)
  )
}

export function subtractMoney(total: string, paid: string): string {
  return formatMoney(parseMoney(total) - parseMoney(paid))
}

export function isMoneyZero(value: string): boolean {
  return parseMoney(value) === 0n
}

export function signedPaymentAmount(
  amount: string,
  direction: "OUTGOING" | "INCOMING",
  normalDirection: "OUTGOING" | "INCOMING"
): MoneyCents {
  const cents = parseMoney(amount)
  return direction === normalDirection ? cents : -cents
}
