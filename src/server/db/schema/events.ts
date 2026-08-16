import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { notificationTypeEnum } from "./enums"
import { memberships, organizations, users } from "./identity"

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorUserId: uuid("actor_user_id"),
    actorMembershipId: uuid("actor_membership_id"),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    message: text("message").notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [
        table.organizationId,
        table.actorMembershipId,
        table.actorUserId,
      ],
      foreignColumns: [
        memberships.organizationId,
        memberships.id,
        memberships.userId,
      ],
      name: "activity_events_actor_membership_fk",
    }),
    index("activity_events_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    index("activity_events_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    check(
      "activity_events_entity_pair",
      sql`(${table.entityType} IS NULL) = (${table.entityId} IS NULL)`
    ),
    check(
      "activity_events_actor_pair",
      sql`(${table.actorUserId} IS NULL) = (${table.actorMembershipId} IS NULL)`
    ),
  ]
)

// Application repositories must expose insert-only behavior for this table.
// Production database roles should additionally deny UPDATE and DELETE.
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorUserId: uuid("actor_user_id"),
    actorMembershipId: uuid("actor_membership_id"),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    requestId: varchar("request_id", { length: 100 }),
    correlationId: varchar("correlation_id", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [
        table.organizationId,
        table.actorMembershipId,
        table.actorUserId,
      ],
      foreignColumns: [
        memberships.organizationId,
        memberships.id,
        memberships.userId,
      ],
      name: "audit_events_actor_membership_fk",
    }),
    index("audit_events_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    index("audit_events_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    index("audit_events_actor_idx").on(
      table.organizationId,
      table.actorMembershipId,
      table.createdAt
    ),
    check(
      "audit_events_actor_pair",
      sql`(${table.actorUserId} IS NULL) = (${table.actorMembershipId} IS NULL)`
    ),
  ]
)

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id),
    recipientMembershipId: uuid("recipient_membership_id").notNull(),
    type: notificationTypeEnum("type").default("INFO").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    message: text("message").notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: uuid("entity_id"),
    dedupeKey: varchar("dedupe_key", { length: 180 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [
        table.organizationId,
        table.recipientMembershipId,
        table.recipientUserId,
      ],
      foreignColumns: [
        memberships.organizationId,
        memberships.id,
        memberships.userId,
      ],
      name: "notifications_recipient_fk",
    }),
    uniqueIndex("notifications_org_dedupe_unique")
      .on(table.organizationId, table.dedupeKey)
      .where(sql`${table.dedupeKey} IS NOT NULL`),
    index("notifications_recipient_unread_idx").on(
      table.organizationId,
      table.recipientMembershipId,
      table.readAt,
      table.createdAt
    ),
    check(
      "notifications_entity_pair",
      sql`(${table.entityType} IS NULL) = (${table.entityId} IS NULL)`
    ),
  ]
)
