export type NavItem = { href: string; label: string };

// Global studio tools only. Per-game asset-gen tabs live in the project WorkspaceNav.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/assets", label: "Library" },
  { href: "/editor", label: "Editor" },
  { href: "/biome", label: "Biome" },
  { href: "/systems", label: "Systems" },
  { href: "/roblox", label: "Roblox" },
  { href: "/kit", label: "Kit" },
  { href: "/brief", label: "Brief" },
  { href: "/npc", label: "NPC" },
  { href: "/sample", label: "Sample" },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
