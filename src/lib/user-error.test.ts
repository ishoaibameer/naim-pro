import { describe, expect, it } from "vitest"

import { mapUserFacingError } from "./user-error"

describe("user-facing error mapping", () => {
  it.each([
    ["UnauthorizedError", "", "Sign in required"],
    ["ForbiddenError", "", "Access denied"],
    ["Error", "Record not found", "Record not found"],
    ["Error", "The record changed", "Record changed"],
    ["Error", "Network fetch failed", "Network error"],
    ["ZodError", "", "Check the details"],
  ])("maps %s safely", (name, message, title) => {
    const error = new Error(message)
    error.name = name
    expect(mapUserFacingError(error).title).toBe(title)
  })

  it("never exposes an unknown internal error message", () => {
    const error = new Error("SQL password secret at stack line 42")
    expect(mapUserFacingError(error)).toEqual({
      title: "Something went wrong",
      message:
        "The request could not be completed. Try again or contact an administrator.",
    })
  })
})
