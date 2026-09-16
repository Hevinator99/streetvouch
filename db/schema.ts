import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  googleReviewUrl: text("google_review_url").notNull(),
  ownerEmail: text("owner_email"),
  baselineGoogleReviews: integer("baseline_google_reviews").notNull().default(7),
  currentGoogleReviews: integer("current_google_reviews").notNull().default(7),
  createdAt: text("created_at").notNull(),
});

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id),
  customerName: text("customer_name"), customerEmail: text("customer_email"),
  message: text("message").notNull(),
  contactRequested: integer("contact_requested", { mode: "boolean" }).notNull().default(false),
  severity: text("severity", { enum: ["normal", "attention", "serious"] }).notNull().default("normal"),
  status: text("status", { enum: ["new", "reviewed", "resolved"] }).notNull().default("new"),
  createdAt: text("created_at").notNull(), reviewedAt: text("reviewed_at"), resolvedAt: text("resolved_at"),
}, table => [index("idx_feedback_business_created").on(table.businessId, table.createdAt), index("idx_feedback_business_status").on(table.businessId, table.status)]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey(), businessId: text("business_id").notNull().references(() => businesses.id),
  eventType: text("event_type", { enum: ["page_view", "google_click", "private_submission", "contact_request"] }).notNull(),
  sessionId: text("session_id"), createdAt: text("created_at").notNull(),
}, table => [index("idx_events_business_created").on(table.businessId, table.createdAt), index("idx_events_business_type").on(table.businessId, table.eventType)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), windowStart: integer("window_start").notNull(), count: integer("count").notNull().default(1),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(), feedbackId: text("feedback_id").notNull().references(() => feedback.id),
  kind: text("kind", { enum: ["contact_requested", "serious_feedback"] }).notNull(),
  status: text("status", { enum: ["queued", "sent", "failed"] }).notNull().default("queued"),
  createdAt: text("created_at").notNull(), sentAt: text("sent_at"), lastError: text("last_error"),
});
