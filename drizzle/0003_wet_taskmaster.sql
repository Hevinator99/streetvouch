ALTER TABLE `manager_users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `manager_users` ADD `password_salt` text;--> statement-breakpoint
ALTER TABLE `manager_users` ADD `password_set_at` text;--> statement-breakpoint
PRAGMA optimize;
