export interface UserFacingError {
  title: string
  message: string
}

export function mapUserFacingError(error: unknown): UserFacingError {
  const name = error instanceof Error ? error.name : ""
  const message = error instanceof Error ? error.message : ""
  if (name === "UnauthorizedError" || /authentication required/i.test(message))
    return {
      title: "Sign in required",
      message: "Your session has ended. Sign in and try again.",
    }
  if (
    name === "ForbiddenError" ||
    /not authorized|access denied/i.test(message)
  )
    return {
      title: "Access denied",
      message: "You do not have permission to access this record or action.",
    }
  if (/not found/i.test(message))
    return {
      title: "Record not found",
      message:
        "The record may have been removed, archived, or is outside your access.",
    }
  if (/changed|refresh|concurrency|stale/i.test(message))
    return {
      title: "Record changed",
      message: "Someone updated this record. Refresh and try again.",
    }
  if (/network|fetch/i.test(message))
    return {
      title: "Network error",
      message: "Check your connection and try again.",
    }
  if (name === "ZodError" || /invalid|enter|required/i.test(message))
    return {
      title: "Check the details",
      message: "One or more values are invalid. Review the form and try again.",
    }
  return {
    title: "Something went wrong",
    message:
      "The request could not be completed. Try again or contact an administrator.",
  }
}
