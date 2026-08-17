import { isMoneyZero } from "./money"

export interface SettlementInputs {
  status: string
  finalWeightMt: string | null
  purchaseAmount: string
  vendorBalance: string
  freightAmount: string | null
  transporterBalance: string
  billId: string | null
  companyReceivable: string
}

export interface SettlementReadiness {
  ready: boolean
  blockers: string[]
}

export function evaluateSettlementReadiness(
  input: SettlementInputs
): SettlementReadiness {
  const blockers: string[] = []
  if (!input.finalWeightMt) blockers.push("Final weight is missing")
  if (input.status !== "DELIVERED" && input.status !== "SETTLEMENT_PENDING")
    blockers.push("Trip must be delivered")
  if (!isMoneyZero(input.vendorBalance))
    blockers.push(`Vendor balance ₹${input.vendorBalance} pending`)
  if (input.freightAmount === null)
    blockers.push("Agreed freight amount is missing")
  else if (!isMoneyZero(input.transporterBalance))
    blockers.push(`Transporter balance ₹${input.transporterBalance} pending`)
  if (!input.billId) blockers.push("Company bill not created")
  else if (!isMoneyZero(input.companyReceivable))
    blockers.push(`Company receivable ₹${input.companyReceivable} pending`)
  return { ready: blockers.length === 0, blockers }
}
