import { createFileRoute } from "@tanstack/react-router"

import { GlobalSearchPage } from "@/components/product/global-search-page"
import { globalSearchFn } from "@/server/product/product.functions"
import { globalSearchSchema } from "@/server/product/schemas"

export const Route = createFileRoute("/_authenticated/app/search")({
  validateSearch: globalSearchSchema,
  loaderDeps: ({ search: { q } }) => ({ q }),
  loader: ({ deps }) => globalSearchFn({ data: deps }),
  component: SearchRoute,
})

function SearchRoute() {
  return (
    <GlobalSearchPage
      results={Route.useLoaderData()}
      query={Route.useSearch().q}
    />
  )
}
