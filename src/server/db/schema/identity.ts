import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
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
    weightWarningThresholdPct: numeric("weight_warning_threshold_pct", {
      precision: 6,
      scale: 3,
    })
      .default("1.000")
      .notNull(),
    expectedTransitDurationHours: integer("expected_transit_duration_hours")
      .default(48)
      .notNull(),
    defaultPageSize: integer("default_page_size").default(20).notNull(),
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
    check(
      "organizations_weight_threshold_range",
      sql`${table.weightWarningThresholdPct} > 0 AND ${table.weightWarningThresholdPct} <= 100`
    ),
    check(
      "organizations_transit_duration_range",
      sql`${table.expectedTransitDurationHours} BETWEEN 1 AND 720`
    ),
    check(
      "organizations_default_page_size_range",
      sql`${table.defaultPageSize} BETWEEN 10 AND 100`
    ),
  ]
)

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
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
    securityVersion: integer("security_version").default(1).notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    uniqueIndex("users_phone_e164_unique").on(table.phoneE164),
    check(
      "users_phone_e164_format",
      sql`${table.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$'`
    ),
    check("users_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check("users_security_version_positive", sql`${table.securityVersion} > 0`),
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
    lastActiveAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    userSecurityVersion: integer("user_security_version").notNull(),
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
    check(
      "sessions_security_version_positive",
      sql`${table.userSecurityVersion} > 0`
    ),
  ]
)

export const authLoginFailures = pgTable(
  "auth_login_failures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountKey: varchar("account_key", { length: 64 }).notNull(),
    networkKey: varchar("network_key", { length: 64 }).notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("auth_login_failures_account_time_idx").on(
      table.accountKey,
      table.attemptedAt
    ),
    index("auth_login_failures_network_time_idx").on(
      table.networkKey,
      table.attemptedAt
    ),
    check(
      "auth_login_failures_account_key_format",
      sql`${table.accountKey} ~ '^[a-f0-9]{64}$'`
    ),
    check(
      "auth_login_failures_network_key_format",
      sql`${table.networkKey} ~ '^[a-f0-9]{64}$'`
    ),
  ]
)
