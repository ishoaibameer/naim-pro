const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/

function pow10(scale: number): bigint {
  return 10n ** BigInt(scale)
}

export function parseExactDecimal(
  value: string,
  options: { scale: number; integerDigits: number; positive?: boolean }
): bigint {
  const normalized = value.trim()
  if (!DECIMAL_PATTERN.test(normalized))
    throw new Error("Enter a valid number.")
  const [whole, fraction = ""] = normalized.split(".")
  if (whole.length > options.integerDigits || fraction.length > options.scale) {
    throw new Error(
      `Use at most ${options.integerDigits} digits before and ${options.scale} after the decimal.`
    )
  }
  const scaled =
    BigInt(whole) * pow10(options.scale) +
    BigInt(fraction.padEnd(options.scale, "0") || "0")
  if (options.positive && scaled <= 0n)
    throw new Error("Value must be greater than zero.")
  return scaled
}

export function normalizeExactDecimal(
  value: string,
  options: { scale: number; integerDigits: number; positive?: boolean }
): string {
  const scaled = parseExactDecimal(value, options)
  return formatScaledDecimal(scaled, options.scale)
}

export function formatScaledDecimal(value: bigint, scale: number): string {
  const sign = value < 0n ? "-" : ""
  const absolute = value < 0n ? -value : value
  const base = pow10(scale)
  const whole = absolute / base
  const fraction = (absolute % base).toString().padStart(scale, "0")
  return scale ? `${sign}${whole}.${fraction}` : `${sign}${whole}`
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n
  const sign = numerator < 0n ? -1n : 1n
  const absolute = numerator < 0n ? -numerator : numerator
  return sign * ((absolute + denominator / 2n) / denominator)
}

export const WEIGHT_ISSUE_THRESHOLD_PERCENT = "1.0000"

export interface WeightReconciliation {
  loadedWeightMt: string
  finalWeightMt: string
  differenceMt: string
  differencePercent: string
  hasWeightIssue: boolean
}

export function calculateWeightReconciliation(
  loadedValue: string,
  finalValue: string,
  thresholdPercent = WEIGHT_ISSUE_THRESHOLD_PERCENT
): WeightReconciliation {
  const options = { scale: 3, integerDigits: 9 }
  const loaded = parseExactDecimal(loadedValue, options)
  const final = parseExactDecimal(finalValue, options)
  const difference = loaded - final
  const percentage =
    loaded === 0n ? 0n : divideRounded(difference * 100n * 10_000n, loaded)
  const threshold = parseExactDecimal(thresholdPercent, {
    scale: 4,
    integerDigits: 5,
  })
  return {
    loadedWeightMt: formatScaledDecimal(loaded, 3),
    finalWeightMt: formatScaledDecimal(final, 3),
    differenceMt: formatScaledDecimal(difference, 3),
    differencePercent: formatScaledDecimal(percentage, 4),
    hasWeightIssue: (percentage < 0n ? -percentage : percentage) > threshold,
  }
}
