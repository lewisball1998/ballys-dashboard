import type { BuiltinIcon } from "./types";

/**
 * Curated built-in icon registry (v0.2.6). ⭐ First-party, generic *function*
 * glyphs only — NOT third-party brand logos (licensing/safety deferred). This is
 * a deliberately small starter set + the framework around it; later phases can
 * grow it (and add dark/light/4k variants) without re-architecting.
 *
 * Each glyph is a monochrome SVG in public/icons/builtin/ rendered with
 * currentColor so it adapts to the theme. `aliases` drive name→icon suggestion.
 */
export const BUILTIN_ICONS: readonly BuiltinIcon[] = [
  {
    key: "media",
    label: "Media",
    file: "media.svg",
    monochrome: true,
    aliases: [
      "plex",
      "jellyfin",
      "emby",
      "tv",
      "movies",
      "video",
      "kodi",
      "stream",
      "jellyseerr",
      "overseerr",
      "sonarr",
      "radarr",
    ],
  },
  {
    key: "download",
    label: "Downloads",
    file: "download.svg",
    monochrome: true,
    aliases: [
      "qbittorrent",
      "transmission",
      "sabnzbd",
      "nzbget",
      "deluge",
      "torrent",
      "download",
      "aria2",
      "rtorrent",
    ],
  },
  {
    key: "book",
    label: "Books",
    file: "book.svg",
    monochrome: true,
    aliases: [
      "calibre",
      "audiobookshelf",
      "readarr",
      "kavita",
      "komga",
      "books",
      "library",
      "ebook",
      "wiki",
      "bookstack",
    ],
  },
  {
    key: "shield",
    label: "Network / Security",
    file: "shield.svg",
    monochrome: true,
    aliases: [
      "pihole",
      "adguard",
      "firewall",
      "vpn",
      "wireguard",
      "security",
      "shield",
      "adblock",
      "dns",
      "opnsense",
      "pfsense",
      "network",
    ],
  },
  {
    key: "chart",
    label: "Metrics",
    file: "chart.svg",
    monochrome: true,
    aliases: [
      "grafana",
      "uptime",
      "uptimekuma",
      "prometheus",
      "metrics",
      "stats",
      "monitoring",
      "netdata",
      "graph",
      "analytics",
    ],
  },
  {
    key: "database",
    label: "Database",
    file: "database.svg",
    monochrome: true,
    aliases: [
      "postgres",
      "postgresql",
      "mysql",
      "mariadb",
      "redis",
      "mongo",
      "mongodb",
      "database",
      "sqlite",
      "influxdb",
    ],
  },
  {
    key: "container",
    label: "Containers",
    file: "container.svg",
    monochrome: true,
    aliases: [
      "portainer",
      "docker",
      "kubernetes",
      "container",
      "yacht",
      "dockge",
      "compose",
      "registry",
    ],
  },
  {
    key: "home",
    label: "Home / Dashboard",
    file: "home.svg",
    monochrome: true,
    aliases: [
      "home",
      "homeassistant",
      "hass",
      "dashboard",
      "homepage",
      "homarr",
      "heimdall",
      "house",
    ],
  },
  {
    key: "cloud",
    label: "Cloud / Sync",
    file: "cloud.svg",
    monochrome: true,
    aliases: ["nextcloud", "owncloud", "cloud", "seafile", "syncthing", "drive", "sync", "backup"],
  },
  {
    key: "storage",
    label: "Storage / NAS",
    file: "storage.svg",
    monochrome: true,
    aliases: [
      "nas",
      "truenas",
      "unraid",
      "storage",
      "minio",
      "disk",
      "samba",
      "smb",
      "files",
      "filebrowser",
      "openmediavault",
      "omv",
    ],
  },
  {
    key: "code",
    label: "Code / Git",
    file: "code.svg",
    monochrome: true,
    aliases: [
      "gitea",
      "gitlab",
      "github",
      "git",
      "code",
      "vscode",
      "forgejo",
      "jenkins",
      "drone",
      "woodpecker",
    ],
  },
  {
    key: "mail",
    label: "Mail",
    file: "mail.svg",
    monochrome: true,
    aliases: ["mail", "mailcow", "roundcube", "email", "smtp", "postfix", "imap", "dovecot"],
  },
  {
    key: "music",
    label: "Music",
    file: "music.svg",
    monochrome: true,
    aliases: [
      "navidrome",
      "lidarr",
      "music",
      "airsonic",
      "plexamp",
      "funkwhale",
      "audio",
      "subsonic",
    ],
  },
  {
    key: "photo",
    label: "Photos",
    file: "photo.svg",
    monochrome: true,
    aliases: ["immich", "photoprism", "photo", "photos", "piwigo", "lychee", "gallery", "image"],
  },
  {
    key: "monitor",
    label: "Monitoring",
    file: "monitor.svg",
    monochrome: true,
    aliases: [
      "monitor",
      "glances",
      "scrutiny",
      "librenms",
      "zabbix",
      "status",
      "healthchecks",
      "gotify",
    ],
  },
  {
    key: "generic",
    label: "Generic App",
    file: "generic.svg",
    monochrome: true,
    aliases: ["app", "application", "generic", "misc", "other", "tools", "utility"],
  },
] as const;

const BY_KEY: ReadonlyMap<string, BuiltinIcon> = new Map(BUILTIN_ICONS.map((i) => [i.key, i]));

/** Look up a built-in icon by key (undefined when unknown). */
export function getBuiltinIcon(key: string): BuiltinIcon | undefined {
  return BY_KEY.get(key);
}

/** All built-in icons in registry (display) order. */
export function listBuiltinIcons(): readonly BuiltinIcon[] {
  return BUILTIN_ICONS;
}
