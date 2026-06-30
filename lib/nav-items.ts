export type NavItem = { href: string; label: string };
export type NavGroup = { label?: string; items: NavItem[] };

// Grouped sidebar: ungrouped top links, then Assets / Tools / Framework sections.
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Home" },
      { href: "/creations", label: "Creations" },
    ],
  },
  {
    label: "Assets",
    items: [
      { href: "/assets", label: "Library" },
      { href: "/systems", label: "Systems" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/editor", label: "Editor" },
      { href: "/biome", label: "Biome" },
      { href: "/roblox", label: "Roblox" },
    ],
  },
  {
    label: "Framework",
    items: [
      { href: "/kit", label: "Kit" },
      { href: "/brief", label: "Brief" },
      { href: "/npc", label: "NPC" },
      { href: "/sample", label: "Sample" },
    ],
  },
];

/** Flat list (for the mobile top bar). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
