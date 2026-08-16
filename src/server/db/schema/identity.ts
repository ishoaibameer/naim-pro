import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { recordStatusEnum, roleEnum } from "./enums"

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    legalName: varchar("legal_name", { length: 200 }),
    status: recordStatusEnum("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    check("organizations_version_positive", sql`${table.version} > 0`),
  ]
)

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phoneE164: varchar("phone_e164", { length: 16 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    status: recordStatusEnum("status").default("ACTIVE").notNull(),
    mustChangePassword: boolean("must_change_password")
      .default(false)
      .notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    uniqueIndex("users_phone_e164_unique").on(table.phoneE164),
    check(
      "users_phone_e164_format",
      sql`${table.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$'`
    ),
    check("users_version_positive", sql`${table.version} > 0`),
  ]
)

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: roleEnum("role").notNull(),
    status: recordStatusEnum("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    unique("memberships_organization_user_unique").on(
      table.organizationId,
      table.userId
    ),
    unique("memberships_organization_id_unique").on(
      table.organizationId,
      table.id
    ),
    unique("memberships_org_id_user_unique").on(
      table.organizationId,
      table.id,
      table.userId
    ),
    index("memberships_user_status_idx").on(table.userId, table.status),
    check("memberships_version_positive", sql`${table.version} > 0`),
  ]
)

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    activeMembershipId: uuid("active_membership_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
  },
  (table) => [
    foreignKey({
      name: "sessions_active_membership_fk",
      columns: [table.organizationId, table.activeMembershipId, table.userId],
      foreignColumns: [
        memberships.organizationId,
        memberships.id,
        memberships.userId,
      ],
    }),
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_expires_idx").on(table.userId, table.expiresAt),
    index("sessions_membership_expires_idx").on(
      table.activeMembershipId,
      table.expiresAt
    ),
    check(
      "sessions_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`
    ),
  ]
)
