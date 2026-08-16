import { describe, expect, it } from "vitest"

import {
  ACCOUNT_FAILURE_LIMIT,
  isLoginThrottled,
  NETWORK_FAILURE_LIMIT,
} from "./rate-limit"

describe("login rate-limit policy", () => {
  it("blocks an account after five failures", () => {
    expect(isLoginThrottled(ACCOUNT_FAILURE_LIMIT - 1, 0)).toBe(false)
    expect(isLoginThrottled(ACCOUNT_FAILURE_LIMIT, 0)).toBe(true)
  })

  it("also caps abusive network-wide attempts", () => {
    expect(isLoginThrottled(0, NETWORK_FAILURE_LIMIT)).toBe(true)
  })
})
