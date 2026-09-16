CREATE TABLE `google_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`google_account_name` text,
	`google_location_name` text,
	`google_location_title` text,
	`encrypted_refresh_token` text,
	`token_iv` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_synced_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_connections_business_id_unique` ON `google_connections` (`business_id`);--> statement-breakpoint
CREATE TABLE `google_oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`manager_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_user_id`) REFERENCES `manager_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `google_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`google_review_id` text NOT NULL,
	`reviewer_name` text,
	`rating` integer NOT NULL,
	`comment` text,
	`google_created_at` text NOT NULL,
	`google_updated_at` text NOT NULL,
	`reply_comment` text,
	`reply_status` text DEFAULT 'none' NOT NULL,
	`suggested_reply` text,
	`synced_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_google_reviews_business_review` ON `google_reviews` (`business_id`,`google_review_id`);--> statement-breakpoint
CREATE INDEX `idx_google_reviews_business_created` ON `google_reviews` (`business_id`,`google_created_at`);--> statement-breakpoint
CREATE TABLE `manager_login_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`manager_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`manager_user_id`) REFERENCES `manager_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `manager_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`manager_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`manager_user_id`) REFERENCES `manager_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_manager_sessions_user` ON `manager_sessions` (`manager_user_id`);--> statement-breakpoint
CREATE TABLE `manager_users` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'manager' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_manager_users_business_email` ON `manager_users` (`business_id`,`email`);--> statement-breakpoint
CREATE TABLE `review_automation_settings` (
	`business_id` text PRIMARY KEY NOT NULL,
	`positive_auto_reply` integer DEFAULT false NOT NULL,
	`positive_minimum_rating` integer DEFAULT 4 NOT NULL,
	`escalation_maximum_rating` integer DEFAULT 3 NOT NULL,
	`tone` text DEFAULT 'warm, local and concise' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
PRAGMA optimize;
