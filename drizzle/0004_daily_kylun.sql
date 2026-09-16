ALTER TABLE `manager_login_tokens` ADD `purpose` text DEFAULT 'reset' NOT NULL;--> statement-breakpoint
ALTER TABLE `manager_login_tokens` ADD `pending_password_hash` text;--> statement-breakpoint
ALTER TABLE `manager_login_tokens` ADD `pending_password_salt` text;--> statement-breakpoint
PRAGMA optimize;
