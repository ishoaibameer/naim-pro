import "@tanstack/react-start/server-only"

import { and, desc, eq, ilike, sql } from "drizzle-orm"

import type { SafeAuthContext } from "@/server/auth/types"
import { getDatabase } from "@/server/db/index.server"
import { companies } from "@/server/db/schema"

import {
  normalizeName,
  optionalPhone,
  optionalText,
  recordMutation,
  requireAdmin,
} from "./shared.server"

export interface CompanyInput {
  id?: string
  name: string
  contactPerson: string
  phone: string
  location: string
  address: string
  status: "ACTIVE" | "INACTIVE"
  version?: number
}

export async function listCompanies(actor: SafeAuthContext, search = "") {
  const organizationId = requireAdmin(actor)
  return getDatabase()
    .select({
      id: companies.id,
      name: companies.name,
      contactPerson: companies.contactPerson,
      phone: companies.phoneE164,
      location: companies.location,
      address: companies.billingAddress,
      status: companies.status,
      version: companies.version,
    })
    .from(companies)
    .where(
      and(
        eq(companies.organizationId, organizationId),
        search ? ilike(companies.name, `%${search.trim()}%`) : undefined
      )
    )
    .orderBy(desc(companies.createdAt))
    .limit(50)
}

export async function saveCompany(actor: SafeAuthContext, input: CompanyInput) {
  const organizationId = requireAdmin(actor)
  const now = new Date()
  return getDatabase().transaction(async (transaction) => {
    if (!input.id) {
      const [created] = await transaction
        .insert(companies)
        .values({
          organizationId,
          name: input.name.trim(),
          normalizedName: normalizeName(input.name),
          contactPerson: optionalText(input.contactPerson),
          phoneE164: optionalPhone(input.phone),
          location: optionalText(input.location),
          billingAddress: optionalText(input.address),
          status: input.status,
          createdByMembershipId: actor.membership.id,
          updatedByMembershipId: actor.membership.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: companies.id })
      await recordMutation(transaction, actor, {
        action: "COMPANY_CREATED",
        message: "Company created.",
        entityType: "COMPANY",
        entityId: created.id,
        after: { name: input.name.trim(), status: input.status },
      })
      return created
    }
    if (!input.version) throw new Error("Version is required for updates.")
    const current = (
      await transaction
        .select({
          name: companies.name,
          status: companies.status,
          version: companies.version,
        })
        .from(companies)
        .where(
          and(
            eq(companies.id, input.id),
            eq(companies.organizationId, organizationId),
            eq(companies.version, input.version)
          )
        )
        .limit(1)
    ).at(0)
    if (!current) throw new Error("Company changed; refresh and try again.")
    await transaction
      .update(companies)
      .set({
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        contactPerson: optionalText(input.contactPerson),
        phoneE164: optionalPhone(input.phone),
        location: optionalText(input.location),
        billingAddress: optionalText(input.address),
        status: input.status,
        updatedByMembershipId: actor.membership.id,
        updatedAt: now,
        version: sql`${companies.version} + 1`,
      })
      .where(
        and(eq(companies.id, input.id), eq(companies.version, input.version))
      )
    await recordMutation(transaction, actor, {
      action: "COMPANY_UPDATED",
      message: "Company updated.",
      entityType: "COMPANY",
      entityId: input.id,
      before: current,
      after: {
        name: input.name.trim(),
        status: input.status,
        version: current.version + 1,
      },
    })
    return { id: input.id }
  })
}
