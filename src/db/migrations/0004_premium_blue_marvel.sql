CREATE TABLE `icon_pack_icons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pack_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text,
	`variant` text,
	`sha256` text NOT NULL,
	`ext` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	FOREIGN KEY (`pack_id`) REFERENCES `icon_packs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `icon_pack_icons_pack_key_variant_idx` ON `icon_pack_icons` (`pack_id`,`key`,`variant`);--> statement-breakpoint
CREATE INDEX `icon_pack_icons_pack_key_idx` ON `icon_pack_icons` (`pack_id`,`key`);--> statement-breakpoint
CREATE INDEX `icon_pack_icons_sha256_idx` ON `icon_pack_icons` (`sha256`);--> statement-breakpoint
CREATE TABLE `icon_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`author` text,
	`license` text,
	`homepage` text,
	`manifest_version` integer NOT NULL,
	`icon_count` integer NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer NOT NULL
);
