import type { AuthRole } from "@/server/auth/types"

export type RoleHomePath = "/admin" | "/app" | "/vendor" | "/driver"

export function getRoleHomePath(role: AuthRole): RoleHomePath {
  switch (role) {
    case "ADMIN":
      return "/admin"
    case "MEMBER":
      return "/app"
    case "VENDOR":
      return "/vendor"
    case "DRIVER":
      return "/driver"
  }
}
