import { describe, expect, it } from "vitest"

import { PROTECTED_CORE_FIELDS, slugifyFieldKey } from "./config"
import { saveCustomFieldDefinitionSchema } from "./schemas"
import { isEmptyCustomFieldValue, validateCustomFieldValue } from "./validation"

const base = {
  required: false,
  validation: {},
  options: [] as { code: string; status: "ACTIVE" | "INACTIVE" }[],
}

describe("custom field value validation", () => {
  it("enforces required values without treating false or zero as empty", () => {
    expect(isEmptyCustomFieldValue(false)).toBe(false)
    expect(isEmptyCustomFieldValue(0)).toBe(false)
    expect(() =>
      validateCustomFieldValue(
        { ...base, fieldType: "TEXT", required: true },
        ""
      )
    ).toThrow("required")
  })

  it("normalizes numbers and enforces configured bounds", () => {
    expect(
      validateCustomFieldValue(
        { ...base, fieldType: "QUANTITY_TON", validation: { min: 1, max: 20 } },
        "12.5"
      )
    ).toBe(12.5)
    expect(() =>
      validateCustomFieldValue(
        { ...base, fieldType: "PERCENTAGE", validation: {} },
        101
      )
    ).toThrow("at most 100")
    expect(() =>
      validateCustomFieldValue({ ...base, fieldType: "CURRENCY" }, -1)
    ).toThrow("at least 0")
  })

  it("validates active select options and deduplicates multi-select values", () => {
    const options = [
      { code: "a", status: "ACTIVE" as const },
      { code: "old", status: "INACTIVE" as const },
    ]
    expect(
      validateCustomFieldValue(
        { ...base, fieldType: "MULTI_SELECT", options },
        ["a", "a"]
      )
    ).toEqual(["a"])
    expect(() =>
      validateCustomFieldValue({ ...base, fieldType: "SELECT", options }, "old")
    ).toThrow("valid option")
  })

  it("normalizes Indian phone values and validates temporal values", () => {
    expect(
      validateCustomFieldValue({ ...base, fieldType: "PHONE" }, "90120 12777")
    ).toBe("+919012012777")
    expect(
      validateCustomFieldValue({ ...base, fieldType: "DATE" }, "2026-08-17")
    ).toBe("2026-08-17")
    expect(() =>
      validateCustomFieldValue({ ...base, fieldType: "DATETIME" }, "17 August")
    ).toThrow("valid date and time")
  })

  it("requires document references to be UUIDs and limits text length", () => {
    expect(() =>
      validateCustomFieldValue({ ...base, fieldType: "DOCUMENT" }, "file.pdf")
    ).toThrow()
    expect(() =>
      validateCustomFieldValue(
        { ...base, fieldType: "TEXT", validation: { maxLength: 3 } },
        "four"
      )
    ).toThrow("3 characters")
  })
})

describe("custom field definition controls", () => {
  const validDefinition = {
    target: "DEAL" as const,
    key: "quality_grade",
    label: "Quality grade",
    fieldType: "SELECT" as const,
    sectionKey: "QUALITY",
    required: true,
    requiredRoles: ["MEMBER" as const],
    visibleRoles: ["ADMIN" as const, "MEMBER" as const],
    editableRoles: ["ADMIN" as const, "MEMBER" as const],
    sortOrder: 0,
    allowedDocumentTypes: [],
    options: [{ code: "a", label: "Grade A" }],
  }

  it("rejects unsafe sections and role combinations", () => {
    expect(
      saveCustomFieldDefinitionSchema.safeParse({
        ...validDefinition,
        sectionKey: "INJECTED",
      }).success
    ).toBe(false)
    expect(
      saveCustomFieldDefinitionSchema.safeParse({
        ...validDefinition,
        visibleRoles: ["ADMIN"],
      }).success
    ).toBe(false)
  })

  it("requires options only for select types and valid numeric ranges", () => {
    expect(
      saveCustomFieldDefinitionSchema.safeParse({
        ...validDefinition,
        options: [],
      }).success
    ).toBe(false)
    expect(
      saveCustomFieldDefinitionSchema.safeParse({
        ...validDefinition,
        fieldType: "NUMBER",
        options: [],
        min: 10,
        max: 2,
      }).success
    ).toBe(false)
  })

  it("defers required document fields until a parent trip exists", () => {
    expect(
      saveCustomFieldDefinitionSchema.safeParse({
        ...validDefinition,
        fieldType: "DOCUMENT",
        options: [],
      }).success
    ).toBe(false)
    expect(
      saveCustomFieldDefinitionSchema.safeParse({
        ...validDefinition,
        target: "TRIP_LOADING",
        sectionKey: "DOCUMENTS",
        fieldType: "DOCUMENT",
        options: [],
      }).success
    ).toBe(true)
  })

  it("keeps delivery core identity protected and keys deterministic", () => {
    expect(
      PROTECTED_CORE_FIELDS.TRIP_DELIVERY.map((field) => field.key)
    ).toEqual([
      "delivery_challan_number",
      "vehicle",
      "final_weight_mt",
      "weighment_card_number",
    ])
    expect(slugifyFieldKey("  Quality / Grade  ")).toBe("quality_grade")
  })
})
