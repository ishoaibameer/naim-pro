export const ACCOUNT_FAILURE_LIMIT = 5
export const NETWORK_FAILURE_LIMIT = 20
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000

export function isLoginThrottled(
  accountFailures: number,
  networkFailures: number
): boolean {
  return (
    accountFailures >= ACCOUNT_FAILURE_LIMIT ||
    networkFailures >= NETWORK_FAILURE_LIMIT
  )
}
