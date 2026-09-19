import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  googleReviewUrl: text("google_review_url").notNull(),
  ownerEmail: text("owner_email"),
  baselineGoogleReviews: integer("baseline_google_reviews").notNull().default(7),
  currentGoogleReviews: integer("current_google_reviews").notNull().default(7),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  reportEmail: text("report_email"),
  reportDay: integer("report_day").notNull().default(1),
  lastReportSentAt: text("last_report_sent_at"),
  logoUrl: text("logo_url"),
  address: text("address"),
  category: text("category"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  website: text("website"),
  openingHours: text("opening_hours"),
  googleProfileUrl: text("google_profile_url"),
  status: text("status", { enum: ["setup", "awaiting_approval", "active", "paused", "completed"] }).notNull().default("setup"),
  customerHeading: text("customer_heading").notNull().default("How was your visit?"),
  customerIntro: text("customer_intro").notNull().default("Share an honest review or send feedback privately."),
  customerPrivatePrompt: text("customer_private_prompt").notNull().default("Something we should know?"),
  pageApproved: integer("page_approved", { mode: "boolean" }).notNull().default(false),
  pageApprovedAt: text("page_approved_at"),
  pilotStartedAt: text("pilot_started_at"),
  pilotCompletedAt: text("pilot_completed_at"),
  onboardingHandoffAt: text("onboarding_handoff_at"),
  updatedAt: text("updated_at"),
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
  contactedAt: text("contacted_at"),
  internalNote: text("internal_note"),
  createdAt: text("created_at").notNull(), reviewedAt: text("reviewed_at"), resolvedAt: text("resolved_at"),
}, table => [index("idx_feedback_business_created").on(table.businessId, table.createdAt), index("idx_feedback_business_status").on(table.businessId, table.status)]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey(), businessId: text("business_id").notNull().references(() => businesses.id),
  eventType: text("event_type", { enum: ["page_view", "nfc_tap", "qr_scan", "google_click", "private_submission", "contact_request"] }).notNull(),
  assetId: text("asset_id"),
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

export const managerUsers = sqliteTable("manager_users", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id),
  email: text("email").notNull(),
  displayName: text("display_name"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordSetAt: text("password_set_at"),
  role: text("role", { enum: ["manager", "owner"] }).notNull().default("manager"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  invitedAt: text("invited_at"),
  invitationAcceptedAt: text("invitation_accepted_at"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
}, table => [uniqueIndex("idx_manager_users_business_email").on(table.businessId, table.email)]);

export const managerLoginTokens = sqliteTable("manager_login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  managerUserId: text("manager_user_id").notNull().references(() => managerUsers.id),
  purpose: text("purpose", { enum: ["reset", "signup", "invitation"] }).notNull().default("reset"),
  pendingPasswordHash: text("pending_password_hash"),
  pendingPasswordSalt: text("pending_password_salt"),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});

export const managerSessions = sqliteTable("manager_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  managerUserId: text("manager_user_id").notNull().references(() => managerUsers.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  scope: text("scope", { enum: ["full", "password_reset"] }).notNull().default("full"),
}, table => [index("idx_manager_sessions_user").on(table.managerUserId)]);

export const googleConnections = sqliteTable("google_connections", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().unique().references(() => businesses.id),
  googleAccountName: text("google_account_name"),
  googleLocationName: text("google_location_name"),
  googleLocationTitle: text("google_location_title"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  tokenIv: text("token_iv"),
  status: text("status", { enum: ["not_connected", "awaiting_authorisation", "pending", "connected", "sync_failed", "reauthorisation_required", "needs_attention", "disconnected"] }).notNull().default("not_connected"),
  lastSyncedAt: text("last_synced_at"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const businessAssets = sqliteTable("business_assets", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id),
  token: text("token").notNull().unique(),
  label: text("label").notNull(),
  placement: text("placement").notNull(),
  assetType: text("asset_type", { enum: ["counter", "barber_station", "window", "card", "other"] }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  nfcTestedAt: text("nfc_tested_at"),
  qrTestedAt: text("qr_tested_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [index("idx_business_assets_business").on(table.businessId), uniqueIndex("idx_business_assets_token").on(table.token)]);

export const onboardingChecks = sqliteTable("onboarding_checks", {
  businessId: text("business_id").primaryKey().references(() => businesses.id),
  businessDetailsComplete: integer("business_details_complete", { mode: "boolean" }).notNull().default(false),
  managerAccountActive: integer("manager_account_active", { mode: "boolean" }).notNull().default(false),
  googleConnectionTested: integer("google_connection_tested", { mode: "boolean" }).notNull().default(false),
  customerPageApproved: integer("customer_page_approved", { mode: "boolean" }).notNull().default(false),
  nfcTested: integer("nfc_tested", { mode: "boolean" }).notNull().default(false),
  qrTested: integer("qr_tested", { mode: "boolean" }).notNull().default(false),
  privateFeedbackTested: integer("private_feedback_tested", { mode: "boolean" }).notNull().default(false),
  notificationEmailTested: integer("notification_email_tested", { mode: "boolean" }).notNull().default(false),
  pilotActivated: integer("pilot_activated", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

export const googleReviews = sqliteTable("google_reviews", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id),
  googleReviewId: text("google_review_id").notNull(),
  reviewerName: text("reviewer_name"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  googleCreatedAt: text("google_created_at").notNull(),
  googleUpdatedAt: text("google_updated_at").notNull(),
  replyComment: text("reply_comment"),
  replyStatus: text("reply_status", { enum: ["none", "draft", "published", "escalated"] }).notNull().default("none"),
  suggestedReply: text("suggested_reply"),
  syncedAt: text("synced_at").notNull(),
}, table => [uniqueIndex("idx_google_reviews_business_review").on(table.businessId, table.googleReviewId), index("idx_google_reviews_business_created").on(table.businessId, table.googleCreatedAt)]);

export const googleOauthStates = sqliteTable("google_oauth_states", {
  stateHash: text("state_hash").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id),
  managerUserId: text("manager_user_id").notNull().references(() => managerUsers.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const reviewAutomationSettings = sqliteTable("review_automation_settings", {
  businessId: text("business_id").primaryKey().references(() => businesses.id),
  positiveAutoReply: integer("positive_auto_reply", { mode: "boolean" }).notNull().default(false),
  positiveMinimumRating: integer("positive_minimum_rating").notNull().default(4),
  escalationMaximumRating: integer("escalation_maximum_rating").notNull().default(3),
  tone: text("tone").notNull().default("warm, local and concise"),
  updatedAt: text("updated_at").notNull(),
});

export const reportDeliveries = sqliteTable("report_deliveries", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id),
  recipientEmail: text("recipient_email").notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  error: text("error"),
  snapshot: text("snapshot"),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_report_deliveries_business_created").on(table.businessId, table.createdAt)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_audit_events_business_created").on(table.businessId, table.createdAt)]);

export const aiAnalyses = sqliteTable("ai_analyses", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id),
  sourceType: text("source_type", { enum: ["feedback", "google_review"] }).notNull(),
  sourceId: text("source_id").notNull(),
  urgency: text("urgency", { enum: ["routine", "attention", "urgent", "critical"] }).notNull(),
  confidence: integer("confidence").notNull(),
  sentiment: text("sentiment", { enum: ["positive", "mixed", "negative", "neutral"] }).notNull(),
  themes: text("themes").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  draftReply: text("draft_reply").notNull(),
  rationale: text("rationale").notNull(),
  model: text("model").notNull(),
  status: text("status", { enum: ["suggested", "accepted", "edited", "dismissed"] }).notNull().default("suggested"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("idx_ai_analyses_source").on(table.businessId, table.sourceType, table.sourceId), index("idx_ai_analyses_urgency").on(table.businessId, table.urgency)]);
