CREATE TABLE `dashboard_layouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'user-default' NOT NULL,
	`owner_key` text,
	`name` text,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dashboard_layouts_kind_owner_idx` ON `dashboard_layouts` (`kind`,`owner_key`);