CREATE TABLE `visibility_connections` (
	`business_id` text PRIMARY KEY NOT NULL,
	`encrypted_refresh_token` text,
	`token_iv` text,
	`search_property` text,
	`analytics_property` text,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`last_error` text,
	`last_collected_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visibility_daily` (
	`business_id` text NOT NULL,
	`date` text NOT NULL,
	`search_clicks` integer,
	`search_impressions` integer,
	`search_position_sum` integer,
	`analytics_organic_sessions` integer,
	`ai_referral_sessions` integer,
	`collected_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_visibility_daily_business_date` ON `visibility_daily` (`business_id`,`date`);--> statement-breakpoint
CREATE TABLE `visibility_health` (
	`business_id` text NOT NULL,
	`url` text NOT NULL,
	`status` integer,
	`final_url` text,
	`title` text,
	`noindex` integer,
	`robots_blocked` integer,
	`local_business` integer,
	`issue` text,
	`checked_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_visibility_health_url` ON `visibility_health` (`business_id`,`url`);--> statement-breakpoint
CREATE TABLE `visibility_oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`manager_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_user_id`) REFERENCES `manager_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visibility_search_rows` (
	`business_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`clicks` integer NOT NULL,
	`impressions` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_visibility_rows_key` ON `visibility_search_rows` (`business_id`,`date`,`kind`,`value`);--> statement-breakpoint
CREATE TABLE `visibility_settings` (
	`business_id` text PRIMARY KEY NOT NULL,
	`drop_percent` integer DEFAULT 40 NOT NULL,
	`min_baseline` integer DEFAULT 20 NOT NULL,
	`period_days` integer DEFAULT 7 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
