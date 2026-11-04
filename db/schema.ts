import { pgTable, serial, text, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

// Server-wide settings (e.g. the auto-generated Web Push keys)
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: text().notNull(),
});

// One row per browser/device that allowed notifications
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial().primaryKey(),
  endpoint: text().notNull().unique(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Upcoming alarms for each device
export const alarms = pgTable(
  "alarms",
  {
    id: serial().primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    title: text().notNull(),
    body: text().notNull().default(""),
    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("alarms_subscription_task_idx").on(t.subscriptionId, t.taskId),
    index("alarms_due_idx").on(t.sentAt, t.fireAt),
  ]
);
