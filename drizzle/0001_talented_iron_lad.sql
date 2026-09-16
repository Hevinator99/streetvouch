CREATE INDEX `idx_events_business_created` ON `events` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_events_business_type` ON `events` (`business_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `idx_feedback_business_created` ON `feedback` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_feedback_business_status` ON `feedback` (`business_id`,`status`);--> statement-breakpoint
PRAGMA optimize;
