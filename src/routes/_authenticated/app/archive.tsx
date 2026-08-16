import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/app/archive")({
  beforeLoad: () => {
    throw redirect({
      to: "/app/trips",
      search: {
        tab: "ARCHIVE",
        search: "",
        status: "ALL",
        page: 1,
        pageSize: 20,
      },
    })
  },
})
