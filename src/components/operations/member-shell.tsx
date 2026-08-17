import { useState } from "react"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  IconActivity,
  IconArchive,
  IconBuilding,
  IconChevronDown,
  IconDashboard,
  IconDots,
  IconFileInvoice,
  IconFiles,
  IconLogout,
  IconCash,
  IconBell,
  IconChartBar,
  IconSearch,
  IconTruckDelivery,
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

const primary = [
  { label: "Home", to: "/app", icon: IconDashboard },
  { label: "Deals", to: "/app/deals", icon: IconFileInvoice },
  { label: "Trips", to: "/app/trips", icon: IconTruckDelivery },
] as const
const more = [
  { label: "Search", to: "/app/search", icon: IconSearch },
  { label: "Notifications", to: "/app/notifications", icon: IconBell },
  { label: "Reports", to: "/app/reports", icon: IconChartBar },
  { label: "Payments", to: "/app/payments", icon: IconCash },
  { label: "Documents", to: "/app/documents", icon: IconFiles },
  { label: "Vendors", to: "/app/vendors", icon: IconBuilding },
  { label: "Transporters", to: "/app/transporters", icon: IconTruckDelivery },
  { label: "Companies", to: "/app/companies", icon: IconBuilding },
  { label: "Activity", to: "/app/activity", icon: IconActivity },
  { label: "Archive", to: "/app/archive", icon: IconArchive },
] as const

export function MemberShell({ name, role }: { name: string; role: string }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const logoutFn = useServerFn(logout)
  const [pending, setPending] = useState(false)
  async function signOut() {
    setPending(true)
    try {
      await logoutFn()
    } finally {
      setPending(false)
    }
  }
  const active = (to: string) =>
    to === "/app" ? pathname === to : pathname.startsWith(to)
  return (
    <div className="min-h-svh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-6">
          <div>
            <p className="text-sm font-semibold tracking-widest text-primary uppercase">
              NAIM PRO
            </p>
            <p className="text-xs text-muted-foreground">Operations</p>
          </div>
        </div>
        <Separator />
        <nav
          className="flex flex-1 flex-col gap-1 p-4"
          aria-label="Operations navigation"
        >
          {[...primary, ...more].map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-11 items-center gap-3 px-3 text-sm font-medium",
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
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
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
      <div className="lg:pl-64">
        <header className="sticky top-0 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-sm font-semibold lg:hidden">NAIM PRO</p>
            <p className="text-xs text-muted-foreground">
              Operations workspace
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <span className="max-w-32 truncate">{name}</span>
              <IconChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem onClick={signOut} disabled={pending}>
                  <IconLogout />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Mobile operations navigation"
      >
        <div className="grid h-16 grid-cols-4">
          {primary.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 text-xs text-muted-foreground",
                  active(item.to) && "text-primary"
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            )
          })}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-h-12 flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
              <IconDots className="size-5" />
              More
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="min-w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>More</DropdownMenuLabel>
                {more.map((item) => {
                  const Icon = item.icon
                  return (
                    <DropdownMenuItem
                      key={item.to}
                      render={<Link to={item.to} />}
                    >
                      <Icon />
                      {item.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  )
}
