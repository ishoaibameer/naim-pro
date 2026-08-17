import { useState } from "react"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  IconActivity,
  IconBuilding,
  IconCar,
  IconChevronDown,
  IconDashboard,
  IconDots,
  IconFileInvoice,
  IconFiles,
  IconForms,
  IconLogout,
  IconMapPin,
  IconPackage,
  IconSettings,
  IconBell,
  IconChartBar,
  IconSearch,
  IconSteeringWheel,
  IconTruck,
  IconTruckDelivery,
  IconUsers,
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
  {
    label: "Overview",
    links: [{ label: "Dashboard", to: "/admin", icon: IconDashboard }],
  },
  {
    label: "Users",
    links: [
      { label: "Members", to: "/admin/members", icon: IconUsers },
      { label: "Vendors", to: "/admin/vendors", icon: IconBuilding },
      { label: "Drivers", to: "/admin/drivers", icon: IconSteeringWheel },
    ],
  },
  {
    label: "Masters",
    links: [
      { label: "Transporters", to: "/admin/transporters", icon: IconTruck },
      { label: "Vehicles", to: "/admin/vehicles", icon: IconCar },
      { label: "Companies", to: "/admin/companies", icon: IconBuilding },
      { label: "Materials", to: "/admin/materials", icon: IconPackage },
      { label: "Locations", to: "/admin/locations", icon: IconMapPin },
    ],
  },
  {
    label: "Operations",
    links: [
      { label: "Deals", to: "/app/deals", icon: IconFileInvoice },
      { label: "Trips", to: "/app/trips", icon: IconTruckDelivery },
      { label: "Documents", to: "/app/documents", icon: IconFiles },
      { label: "Reports", to: "/app/reports", icon: IconChartBar },
      { label: "Search", to: "/app/search", icon: IconSearch },
      { label: "Notifications", to: "/app/notifications", icon: IconBell },
    ],
  },
  {
    label: "System",
    links: [
      { label: "Form Builder", to: "/admin/form-builder", icon: IconForms },
      { label: "Activity", to: "/admin/activity", icon: IconActivity },
      { label: "Settings", to: "/admin/settings", icon: IconSettings },
    ],
  },
] as const

const mobilePrimary = [
  navigation[0].links[0],
  navigation[1].links[0],
  navigation[3].links[1],
] as const

export function AdminShell({ adminName }: { adminName: string }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const logoutFn = useServerFn(logout)
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function signOut() {
    setIsSigningOut(true)
    try {
      await logoutFn()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-6">
          <div>
            <p className="text-sm font-semibold tracking-widest text-primary uppercase">
              NAIM PRO
            </p>
            <p className="text-xs text-muted-foreground">Administration</p>
          </div>
        </div>
        <Separator />
        <nav
          className="flex flex-1 flex-col gap-6 overflow-y-auto p-4"
          aria-label="Admin navigation"
        >
          {navigation.map((section) => (
            <div className="flex flex-col gap-1" key={section.label}>
              <p className="px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {section.label}
              </p>
              {section.links.map((item) => {
                const active =
                  item.to === "/admin"
                    ? pathname === item.to
                    : pathname.startsWith(item.to)
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex min-h-11 items-center gap-3 px-3 text-sm font-medium",
                      active &&
                        "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <Separator />
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{adminName}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            disabled={isSigningOut}
            aria-label="Sign out"
          >
            {isSigningOut ? <Spinner /> : <IconLogout />}
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-sm font-semibold lg:hidden">NAIM PRO</p>
            <p className="text-xs text-muted-foreground">Admin workspace</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <span className="max-w-32 truncate">{adminName}</span>
              <IconChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem onClick={signOut} disabled={isSigningOut}>
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
        aria-label="Mobile admin navigation"
      >
        <div className="grid h-16 grid-cols-4">
          {mobilePrimary.map((item) => {
            const Icon = item.icon
            const active =
              item.to === "/admin"
                ? pathname === item.to
                : pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 text-xs text-muted-foreground",
                  active && "text-primary"
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
              {navigation.slice(1).map((section) => (
                <DropdownMenuGroup key={section.label}>
                  <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
                  {section.links.map((item) => {
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
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  )
}
