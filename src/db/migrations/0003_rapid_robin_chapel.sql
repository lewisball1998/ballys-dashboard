CREATE TABLE `custom_icons` (
	`id` text PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`ext` text NOT NULL,
	`bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `custom_icons_sha256_idx` ON `custom_icons` (`sha256`);