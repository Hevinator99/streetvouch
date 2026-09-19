CREATE TABLE `operator_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`feedback_id` text,
	`kind` text DEFAULT 'reply' NOT NULL,
	`recipient` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`provider_id` text,
	`error` text,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_operator_messages_feedback` ON `operator_messages` (`feedback_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_operator_messages_status` ON `operator_messages` (`status`,`business_id`);--> statement-breakpoint
ALTER TABLE `feedback` ADD `assignee` text;--> statement-breakpoint
ALTER TABLE `feedback` ADD `due_at` text;