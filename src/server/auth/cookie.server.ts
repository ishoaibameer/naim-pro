import "@tanstack/react-start/server-only"

import {
  getRequestHeader,
  setResponseHeader,
} from "@tanstack/react-start/server"

import { SESSION_ABSOLUTE_LIFETIME_MS } from "./session-policy"

const PRODUCTION_COOKIE_NAME = "__Host-naim_session"
const DEVELOPMENT_COOKIE_NAME = "naim_session"

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_COOKIE_NAME
    : DEVELOPMENT_COOKIE_NAME
}

export function readSessionToken(): string | null {
  const cookieHeader = getRequestHeader("cookie")
  if (!cookieHeader) return null

  const cookieName = getSessionCookieName()
  for (const part of cookieHeader.split(/;\s*/)) {
    const separator = part.indexOf("=")
    if (separator < 0 || part.slice(0, separator) !== cookieName) continue
    return part.slice(separator + 1) || null
  }
  return null
}

export function setSessionCookie(token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  const maxAgeSeconds = Math.floor(SESSION_ABSOLUTE_LIFETIME_MS / 1000)

  setResponseHeader(
    "Set-Cookie",
    `${getSessionCookieName()}=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`
  )
}

export function clearSessionCookie(): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  setResponseHeader(
    "Set-Cookie",
    `${getSessionCookieName()}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`
  )
}
