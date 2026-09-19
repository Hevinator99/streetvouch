CREATE TABLE `business_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`token` text NOT NULL,
	`label` text NOT NULL,
	`placement` text NOT NULL,
	`asset_type` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`nfc_tested_at` text,
	`qr_tested_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_assets_token_unique` ON `business_assets` (`token`);--> statement-breakpoint
CREATE INDEX `idx_business_assets_business` ON `business_assets` (`business_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_business_assets_token` ON `business_assets` (`token`);--> statement-breakpoint
CREATE TABLE `onboarding_checks` (
	`business_id` text PRIMARY KEY NOT NULL,
	`business_details_complete` integer DEFAULT false NOT NULL,
	`manager_account_active` integer DEFAULT false NOT NULL,
	`google_connection_tested` integer DEFAULT false NOT NULL,
	`customer_page_approved` integer DEFAULT false NOT NULL,
	`nfc_tested` integer DEFAULT false NOT NULL,
	`qr_tested` integer DEFAULT false NOT NULL,
	`private_feedback_tested` integer DEFAULT false NOT NULL,
	`notification_email_tested` integer DEFAULT false NOT NULL,
	`pilot_activated` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_google_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`google_account_name` text,
	`google_location_name` text,
	`google_location_title` text,
	`encrypted_refresh_token` text,
	`token_iv` text,
	`status` text DEFAULT 'not_connected' NOT NULL,
	`last_synced_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_google_connections`("id", "business_id", "google_account_name", "google_location_name", "google_location_title", "encrypted_refresh_token", "token_iv", "status", "last_synced_at", "last_error", "created_at", "updated_at") SELECT "id", "business_id", "google_account_name", "google_location_name", "google_location_title", "encrypted_refresh_token", "token_iv", "status", "last_synced_at", "last_error", "created_at", "updated_at" FROM `google_connections`;--> statement-breakpoint
DROP TABLE `google_connections`;--> statement-breakpoint
ALTER TABLE `__new_google_connections` RENAME TO `google_connections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `google_connections_business_id_unique` ON `google_connections` (`business_id`);--> statement-breakpoint
ALTER TABLE `businesses` ADD `logo_url` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `address` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `category` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `contact_email` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `website` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `opening_hours` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `google_profile_url` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `status` text DEFAULT 'setup' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `customer_heading` text DEFAULT 'How was your visit?' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `customer_intro` text DEFAULT 'Share an honest review or send feedback privately.' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `customer_private_prompt` text DEFAULT 'Something we should know?' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `page_approved` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `page_approved_at` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `pilot_started_at` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `pilot_completed_at` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `onboarding_handoff_at` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `events` ADD `asset_id` text;--> statement-breakpoint
ALTER TABLE `manager_users` ADD `invited_at` text;--> statement-breakpoint
ALTER TABLE `manager_users` ADD `invitation_accepted_at` text;--> statement-breakpoint
ALTER TABLE `manager_users` ADD `last_login_at` text;