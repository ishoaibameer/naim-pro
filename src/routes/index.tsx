import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <main className="flex min-h-svh items-center p-6">
      <section className="flex max-w-md min-w-0 flex-col gap-3">
        <p className="text-sm font-semibold tracking-widest text-primary uppercase">
          NAIM PRO
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Foundation in progress
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Mobile-first wood trading, logistics, payment, document, and audit
          management system.
        </p>
      </section>
    </main>
  )
}
