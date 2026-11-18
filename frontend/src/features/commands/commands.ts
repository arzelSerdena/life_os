import type { SearchHitRead } from "../../client/types.gen";

/** What a command does when it is run. */
export type CommandAction =
  | { kind: "go"; to: string }
  | { kind: "new-task" }
  | { kind: "new-event" }
  | { kind: "toggle-sidebar" }
  | { kind: "shortcuts" };

export type Command = {
  id: string;
  label: string;
  /** Extra words it is found by ("Go to Today" by "agenda", say). */
  keywords?: string;
  /** The shortcut it shows on the right. */
  keys?: string[];
  action: CommandAction;
};

/** Every command, in the order the empty palette lists them. */
export const COMMANDS: Command[] = [
  { id: "new-task", label: "New task", keys: ["Ctrl", "N"], action: { kind: "new-task" } },
  { id: "new-event", label: "New event", action: { kind: "new-event" } },
  { id: "home", label: "Go to Home", action: { kind: "go", to: "/home" } },
  { id: "today", label: "Go to Today", action: { kind: "go", to: "/tasks/today" } },
  { id: "inbox", label: "Go to Inbox", action: { kind: "go", to: "/tasks/inbox" } },
  { id: "next-7", label: "Go to Next 7 days", action: { kind: "go", to: "/tasks/next-7-days" } },
  { id: "all-tasks", label: "Go to All tasks", action: { kind: "go", to: "/tasks/all" } },
  {
    id: "unscheduled",
    label: "Go to Unscheduled",
    action: { kind: "go", to: "/tasks/unscheduled" },
  },
  { id: "calendar", label: "Go to Calendar", action: { kind: "go", to: "/calendar" } },
  {
    id: "plan",
    label: "Go to Plan",
    keywords: "life areas overview",
    action: { kind: "go", to: "/areas" },
  },
  { id: "projects", label: "Go to Projects", action: { kind: "go", to: "/areas/projects" } },
  { id: "routines", label: "Go to Routines", action: { kind: "go", to: "/areas/routines" } },
  {
    id: "archive",
    label: "Go to Finished & archived",
    keywords: "archived completed done",
    action: { kind: "go", to: "/areas/archived" },
  },
  {
    id: "completed",
    label: "Go to Completed tasks",
    action: { kind: "go", to: "/tasks/completed" },
  },
  {
    id: "cancelled",
    label: "Go to Cancelled tasks",
    action: { kind: "go", to: "/tasks/cancelled" },
  },
  {
    id: "settings",
    label: "Go to Settings",
    keywords: "backup restore export",
    action: { kind: "go", to: "/settings" },
  },
  {
    id: "sidebar",
    label: "Show or hide the sidebar",
    keys: ["Ctrl", "B"],
    action: { kind: "toggle-sidebar" },
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    keys: ["?"],
    keywords: "keys help",
    action: { kind: "shortcuts" },
  },
];

/** How well `text` matches: 0 starts with the query, 1 a word does, 2 contains it, null not. */
function matchRank(text: string, query: string): number | null {
  const lower = text.toLowerCase();
  if (lower.startsWith(query)) return 0;
  if (lower.includes(` ${query}`)) return 1;
  return lower.includes(query) ? 2 : null;
}

/**
 * The commands for a query: all of them when it is blank, otherwise those whose label (with
 * or without "Go to") or keywords contain it, best matches first.
 */
export function filterCommands(query: string, commands: Command[] = COMMANDS): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const ranked: { command: Command; rank: number }[] = [];
  for (const command of commands) {
    const ranks = [
      matchRank(command.label, q),
      matchRank(command.label.replace(/^Go to /, ""), q),
      command.keywords ? matchRank(command.keywords, q) : null,
    ].filter((rank): rank is number => rank !== null);
    if (ranks.length > 0) ranked.push({ command, rank: Math.min(...ranks) });
  }
  // The sort is stable, so equal matches keep the list's order.
  return ranked.sort((a, b) => a.rank - b.rank).map((item) => item.command);
}

/** A row of the palette: a command, or an item to jump to. */
export type PaletteRow =
  | { key: string; group: PaletteGroup; kind: "command"; command: Command }
  | { key: string; group: PaletteGroup; kind: "hit"; hit: SearchHitRead };

export type PaletteGroup = "Commands" | "Life areas" | "Projects" | "Routines" | "Tasks";

const HIT_GROUPS: Record<SearchHitRead["kind"], PaletteGroup> = {
  life_area: "Life areas",
  project: "Projects",
  routine: "Routines",
  task: "Tasks",
};

/**
 * The palette's rows. With a query, the items found come first (areas, projects, routines,
 * tasks, as the API orders them) and then the matching commands, except that a command
 * matching from its first letter (typing "inb" for Go to Inbox) comes first.
 */
export function paletteRows(query: string, hits: SearchHitRead[]): PaletteRow[] {
  const commands = filterCommands(query).map(
    (command): PaletteRow => ({
      key: `command-${command.id}`,
      group: "Commands",
      kind: "command",
      command,
    }),
  );
  const items = hits.map(
    (hit): PaletteRow => ({
      key: `${hit.kind}-${hit.id}`,
      group: HIT_GROUPS[hit.kind],
      kind: "hit",
      hit,
    }),
  );
  const q = query.trim().toLowerCase();
  const leads =
    q !== "" &&
    commands.some(
      (row) =>
        row.kind === "command" &&
        (matchRank(row.command.label, q) === 0 ||
          matchRank(row.command.label.replace(/^Go to /, ""), q) === 0),
    );
  return leads ? [...commands, ...items] : [...items, ...commands];
}

const STATUS_NAMES: Record<string, string> = { done: "Done", cancelled: "Cancelled" };

/** The data line under an item: where it lives and, when finished, its status. */
export function hitMeta(hit: SearchHitRead): string {
  const parts: string[] = [];
  if (hit.kind === "project" || hit.kind === "task") {
    if (hit.life_area_title) parts.push(hit.life_area_title);
    if (hit.project_title) parts.push(hit.project_title);
    if (hit.kind === "task" && !hit.life_area_id) parts.push("Inbox");
  }
  const status = hit.status ? STATUS_NAMES[hit.status] : undefined;
  if (status) parts.push(status);
  return parts.join(" · ");
}

/** Where an item opens: an area, project or routine page, or a task in the detail panel. */
export type HitTarget = { kind: "go"; to: string } | { kind: "panel"; id: number };

export function hitTarget(hit: SearchHitRead): HitTarget {
  switch (hit.kind) {
    case "life_area":
      return { kind: "go", to: `/areas/${hit.id}` };
    case "project":
      return { kind: "go", to: `/areas/projects/${hit.id}` };
    case "routine":
      return { kind: "go", to: `/areas/routines/${hit.id}` };
    case "task":
      return { kind: "panel", id: hit.id };
  }
}
