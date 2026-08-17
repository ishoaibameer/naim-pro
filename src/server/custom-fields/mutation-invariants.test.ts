// @vitest-environment node

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

function source(file: string) {
  return readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8")
}

const builder = source("builder.server.ts")
const values = source("values.server.ts")
const schema = source("../db/schema/custom-fields.ts")

describe("custom field mutation invariants", () => {
  it("has no hard-delete path for definitions, versions, or values", () => {
    expect(builder).not.toContain(".delete(")
    expect(values).not.toContain(".delete(")
    expect(builder).toContain("status: input.status")
  })

  it("creates a new immutable version for edits, status, and reordering", () => {
    expect(builder.match(/insertDefinitionVersion\(/g)?.length).toBeGreaterThan(
      3
    )
    expect(builder).toContain("currentVersionNumber + 1")
    expect(builder).toContain(
      "Field type cannot change after the field has values"
    )
    expect(builder).toContain(
      "Internal key cannot change after the field has values"
    )
  })

  it("protects configuration and records its complete audit trail", () => {
    expect(builder).toContain('requireRole(actor, ["ADMIN"])')
    expect(builder).toContain("assertNotCoreField")
    for (const action of [
      "CUSTOM_FIELD_CREATED",
      "CUSTOM_FIELD_UPDATED",
      "CUSTOM_FIELD_RENAMED",
      "CUSTOM_FIELD_ACTIVATED",
      "CUSTOM_FIELD_DEACTIVATED",
      "CUSTOM_FIELD_REORDERED",
    ])
      expect(builder).toContain(action)
  })

  it("rejects wrong-target and unauthorized submissions server-side", () => {
    expect(values).toContain("activeById.get(submitted.definitionId)")
    expect(values).toContain("roleCanEdit(actor.membership.role")
    expect(values).toContain("throw new ForbiddenError()")
    expect(values).toContain("field.requiredRoles.includes")
  })

  it("authorizes document references and audits changed values", () => {
    expect(values).toContain("authorizeDocumentRecord")
    expect(values).toContain("documentAttachments")
    expect(values).toContain("CUSTOM_FIELD_VALUE_SAVED")
    expect(values).toContain("recordValueAudit")
  })

  it("enforces organization-scoped explicit relational targets", () => {
    expect(schema).toContain("custom_field_values_exactly_one_target")
    for (const target of ["deal", "trip", "vendor", "driver", "payment"])
      expect(schema).toContain(`custom_field_values_${target}_fk`)
    expect(schema).toContain("custom_field_values_definition_version_fk")
    expect(schema).toContain("custom_field_definitions_org_target_key_unique")
  })

  it("batch-loads definitions, options, roles, and record values", () => {
    expect(builder).toContain("inArray(customFieldOptions.fieldVersionId")
    expect(builder).toContain("inArray(customFieldVisibleRoles.fieldVersionId")
    expect(builder).toContain("inArray(customFieldEditableRoles.fieldVersionId")
    expect(values).toContain("existingByDefinition")
  })
})
