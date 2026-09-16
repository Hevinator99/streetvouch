CREATE TABLE `ai_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`urgency` text NOT NULL,
	`confidence` integer NOT NULL,
	`sentiment` text NOT NULL,
	`themes` text NOT NULL,
	`recommended_action` text NOT NULL,
	`draft_reply` text NOT NULL,
	`rationale` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_analyses_source` ON `ai_analyses` (`business_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_analyses_urgency` ON `ai_analyses` (`business_id`,`urgency`);