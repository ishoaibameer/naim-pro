import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

async function login(
  page: Page,
  role: "ADMIN" | "MEMBER" | "VENDOR" | "DRIVER"
) {
  const phone = process.env[`E2E_${role}_PHONE`]
  const password = process.env[`E2E_${role}_PASSWORD`]
  test.skip(
    !phone || !password,
    `Isolated ${role} credentials are not configured.`
  )
  await page.goto("/login")
  await page.getByLabel(/phone/i).fill(phone!)
  await page.getByLabel(/password/i).fill(password!)
  const submit = page.getByRole("button", { name: /login|sign in/i })
  await expect(submit).toBeEnabled({ timeout: 30_000 })
  await submit.click()
  const home = {
    ADMIN: "/admin",
    MEMBER: "/app",
    VENDOR: "/vendor",
    DRIVER: "/driver",
  }[role]
  await expect(page).toHaveURL(new RegExp(`${home}(?:/|$)`), {
    timeout: 15_000,
  })
}

test("signed-out users cannot open an internal route directly", async ({
  page,
}) => {
  await page.goto("/app/reports")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
})

test("Admin can authenticate through the real login UI", async ({ page }) => {
  await login(page, "ADMIN")
  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
})

for (const account of [
  ["MEMBER", "/app"],
  ["VENDOR", "/vendor"],
  ["DRIVER", "/driver"],
] as const) {
  test(`${account[0]} reaches only its role home after login`, async ({
    page,
  }) => {
    await login(page, account[0])
    await expect(page).toHaveURL(new RegExp(`${account[1]}(?:/|$)`))
  })
}

for (const [role, protectedPath, roleHome] of [
  ["MEMBER", "/admin", "/app"],
  ["VENDOR", "/app/reports", "/vendor"],
  ["DRIVER", "/app/payments", "/driver"],
] as const) {
  test(`${role} is denied a direct URL outside its role`, async ({ page }) => {
    await login(page, role)
    await page.goto(protectedPath)
    await expect(page).toHaveURL(new RegExp(`${roleHome}(?:/|$)`))
  })
}
