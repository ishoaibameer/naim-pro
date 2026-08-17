import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 390, height: 844 } })

test("Admin creates missing Deal masters inline without losing Deal state", async ({
  page,
}) => {
  const phone = process.env.E2E_ADMIN_PHONE
  const password = process.env.E2E_ADMIN_PASSWORD
  test.skip(
    !phone || !password,
    "Isolated Admin credentials are not configured."
  )

  await page.goto("/login")
  await page.getByLabel(/phone/i).fill(phone!)
  await page.getByLabel(/password/i).fill(password!)
  const login = page.getByRole("button", { name: /login|sign in/i })
  await expect(login).toBeEnabled({ timeout: 30_000 })
  await login.click()
  await expect(page).toHaveURL(/\/admin(?:\/|$)/, { timeout: 15_000 })

  await page.goto("/app/deals/new")
  await page.getByLabel("Purchase Rate per ton *").fill("8750.50")
  await page.getByLabel("Expected Quantity (Ton)").fill("42.750")
  await page.getByLabel("Notes").fill("Retain this Deal draft")

  await page.getByRole("button", { name: /^(Add|Create) Vendor$/ }).click()
  await page.getByLabel("Vendor Name *").fill("E2E Inline Vendor")
  await page.getByLabel("Contact Person").fill("E2E Contact")
  await page.getByRole("button", { name: "Save Vendor" }).click()
  await expect(page.locator("#vendorId")).not.toHaveValue("")

  await page.getByRole("button", { name: /^(Add|Create) Location$/ }).click()
  await page.getByLabel("Location Name *").fill("E2E Inline Pickup")
  await expect(page.getByLabel("Type *")).toHaveValue("PICKUP")
  await page.getByRole("button", { name: "Save Location" }).click()
  await expect(page.locator("#pickupLocationId")).not.toHaveValue("")

  await page.getByRole("button", { name: /^(Add|Create) Material$/ }).click()
  await page.getByLabel("Material Name *").fill("E2E Inline Timber")
  await page.getByRole("button", { name: "Save Material" }).click()
  await expect(page.locator("#materialId")).not.toHaveValue("")

  await expect(page.getByLabel("Purchase Rate per ton *")).toHaveValue(
    "8750.50"
  )
  await expect(page.getByLabel("Expected Quantity (Ton)")).toHaveValue("42.750")
  await expect(page.getByLabel("Notes")).toHaveValue("Retain this Deal draft")
})
