import { useState } from "react"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  IconChevronDown,
  IconClock,
  IconHistory,
  IconLogout,
  IconRoute,
  IconUser,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { logout } from "@/server/auth/auth.functions"

const navigation = [
  { label: "Current", to: "/driver", icon: IconClock },
  { label: "Trips", to: "/driver/trips", icon: IconRoute },
  { label: "History", to: "/driver/history", icon: IconHistory },
  { label: "Profile", to: "/driver/profile", icon: IconUser },
] as const

export function DriverShell({
  userName,
  driverName,
}: {
  userName: string
  driverName: string
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const logoutFn = useServerFn(logout)
  const [pending, setPending] = useState(false)
  const active = (to: string) =>
    to === "/driver" ? pathname === to : pathname.startsWith(to)
  async function signOut() {
    setPending(true)
    try {
      await logoutFn()
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="min-h-svh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-56 border-r bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-widest text-primary uppercase">
              NAIM PRO
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Driver · {driverName}
            </p>
          </div>
        </div>
        <Separator />
        <nav
          className="flex flex-1 flex-col gap-1 p-3"
          aria-label="Driver navigation"
        >
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-12 items-center gap-3 px-3 text-sm font-medium",
                  active(item.to) &&
                    "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Icon />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <Separator />
        <div className="flex items-center justify-between gap-3 p-4">
          <p className="truncate text-sm font-medium">{userName}</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            disabled={pending}
            aria-label="Sign out"
          >
            {pending ? <Spinner /> : <IconLogout />}
          </Button>
        </div>
      </aside>
      <div className="lg:pl-56">
        <header className="sticky top-0 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold lg:hidden">NAIM PRO</p>
            <p className="truncate text-xs text-muted-foreground">
              {driverName}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <span className="max-w-32 truncate">{userName}</span>
              <IconChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Driver account</DropdownMenuLabel>
                <DropdownMenuItem onClick={signOut} disabled={pending}>
                  <IconLogout /> Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto w-full max-w-4xl p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Mobile Driver navigation"
      >
        <div className="grid h-16 grid-cols-4">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 px-1 text-center text-xs text-muted-foreground",
                  active(item.to) && "text-primary"
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
