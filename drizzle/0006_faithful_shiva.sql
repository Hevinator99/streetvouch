CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`actor_email` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`detail` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_business_created` ON `audit_events` (`business_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`status` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_report_deliveries_business_created` ON `report_deliveries` (`business_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `businesses` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `report_email` text;--> statement-breakpoint
ALTER TABLE `businesses` ADD `report_day` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `last_report_sent_at` text;--> statement-breakpoint
ALTER TABLE `feedback` ADD `contacted_at` text;--> statement-breakpoint
ALTER TABLE `feedback` ADD `internal_note` text;