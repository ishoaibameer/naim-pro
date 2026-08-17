import { useState } from "react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DealInlineMasterSheet,
  DealMasterEmptyState,
} from "./deal-inline-master-sheet"
import type {
  InlineLocationInput,
  InlineMaterialInput,
  InlineMasterResult,
  InlineVendorInput,
} from "./deal-inline-master-sheet"

afterEach(cleanup)

function ParentState({
  children,
}: {
  children: (onCreated: (result: InlineMasterResult) => void) => ReactNode
}) {
  const [selected, setSelected] = useState("")
  const [options, setOptions] = useState<InlineMasterResult[]>([])
  return (
    <form>
      <label htmlFor="test-rate">Purchase Rate</label>
      <Input id="test-rate" defaultValue="8750.50" />
      <label htmlFor="test-quantity">Expected Quantity</label>
      <Input id="test-quantity" defaultValue="42.750" />
      <label htmlFor="test-owner">Owner</label>
      <select id="test-owner" defaultValue="member-1">
        <option value="member-1">Member One</option>
      </select>
      <label htmlFor="test-notes">Notes</label>
      <textarea id="test-notes" defaultValue="Keep these Deal notes" />
      <label htmlFor="test-custom">Custom Field</label>
      <Input id="test-custom" defaultValue="Custom value" />
      <label htmlFor="test-master">Master</label>
      <select id="test-master" value={selected} onChange={() => undefined}>
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {children((result) => {
        setOptions((current) => [
          ...current.filter((option) => option.id !== result.id),
          result,
        ])
        setSelected(result.id)
      })}
    </form>
  )
}

async function expectParentStatePreserved(expectedId: string) {
  await waitFor(() =>
    expect(screen.getByLabelText<HTMLSelectElement>("Master").value).toBe(
      expectedId
    )
  )
  expect(screen.getByLabelText<HTMLInputElement>("Purchase Rate").value).toBe(
    "8750.50"
  )
  expect(
    screen.getByLabelText<HTMLInputElement>("Expected Quantity").value
  ).toBe("42.750")
  expect(screen.getByLabelText<HTMLSelectElement>("Owner").value).toBe(
    "member-1"
  )
  expect(screen.getByLabelText<HTMLTextAreaElement>("Notes").value).toBe(
    "Keep these Deal notes"
  )
  expect(screen.getByLabelText<HTMLInputElement>("Custom Field").value).toBe(
    "Custom value"
  )
}

describe("Deal inline master creation", () => {
  it("creates a Vendor, selects it, and preserves existing Deal values", async () => {
    const create = vi.fn(async (input: InlineVendorInput) => ({
      id: "vendor-1",
      label: input.name,
      created: true,
    }))
    render(
      <ParentState>
        {(onCreated) => (
          <DealInlineMasterSheet
            kind="VENDOR"
            create={create}
            onCreated={onCreated}
          />
        )}
      </ParentState>
    )
    fireEvent.click(screen.getByRole("button", { name: "Add Vendor" }))
    fireEvent.change(screen.getByLabelText("Vendor Name *"), {
      target: { value: "New Timber Vendor" },
    })
    fireEvent.change(screen.getByLabelText("Contact Person"), {
      target: { value: "Vendor Contact" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Vendor" }))
    await expectParentStatePreserved("vendor-1")
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Timber Vendor",
        contactPerson: "Vendor Contact",
      })
    )
  })

  it("creates a PICKUP Location by default and selects it", async () => {
    const create = vi.fn(async (input: InlineLocationInput) => ({
      id: "location-1",
      label: input.name,
      created: true,
    }))
    render(
      <ParentState>
        {(onCreated) => (
          <DealInlineMasterSheet
            kind="LOCATION"
            create={create}
            onCreated={onCreated}
          />
        )}
      </ParentState>
    )
    fireEvent.click(screen.getByRole("button", { name: "Add Location" }))
    fireEvent.change(screen.getByLabelText("Location Name *"), {
      target: { value: "New Pickup Depot" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Location" }))
    await expectParentStatePreserved("location-1")
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Pickup Depot", type: "PICKUP" })
    )
  })

  it("creates a Material and selects it", async () => {
    const create = vi.fn(async (input: InlineMaterialInput) => ({
      id: "material-1",
      label: input.name,
      created: true,
    }))
    render(
      <ParentState>
        {(onCreated) => (
          <DealInlineMasterSheet
            kind="MATERIAL"
            create={create}
            onCreated={onCreated}
          />
        )}
      </ParentState>
    )
    fireEvent.click(screen.getByRole("button", { name: "Add Material" }))
    fireEvent.change(screen.getByLabelText("Material Name *"), {
      target: { value: "New Timber Grade" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Material" }))
    await expectParentStatePreserved("material-1")
  })

  it("keeps the sheet open and shows a friendly inactive duplicate error", async () => {
    const create = vi.fn(async () => {
      throw new Error(
        "Material already exists but is inactive. Ask an administrator to activate it."
      )
    })
    render(
      <DealInlineMasterSheet
        kind="MATERIAL"
        create={create}
        onCreated={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Add Material" }))
    fireEvent.change(screen.getByLabelText("Material Name *"), {
      target: { value: "Existing Timber" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Material" }))
    expect(
      await screen.findByText(/already exists but is inactive/i)
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Add Material" })).toBeTruthy()
  })

  it("shows the required empty-state create CTA", () => {
    render(
      <DealMasterEmptyState label="vendors">
        <Button>Create Vendor</Button>
      </DealMasterEmptyState>
    )
    expect(screen.getByText("No vendors found.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Create Vendor" })).toBeTruthy()
  })
})
