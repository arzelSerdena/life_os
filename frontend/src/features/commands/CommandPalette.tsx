import { Modal } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Archive,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  CalendarRange,
  Check,
  Clock,
  Folder,
  House,
  Inbox,
  Keyboard,
  LayoutGrid,
  type LucideIcon,
  PanelLeft,
  Plus,
  Repeat,
  Search,
  Settings,
  SquareCheck,
  SquareKanban,
  SquareX,
  Sun,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { searchOptions } from "../../client/@tanstack/react-query.gen";
import type { SearchHitRead } from "../../client/types.gen";
import { Scroll } from "../../components/Scroll";
import { useCommands } from "../../stores/commandStore";
import { PANEL_OPENER, useDetailPanel } from "../../stores/detailPanelStore";
import { useNewEvent } from "../../stores/newEventStore";
import { useNewTask } from "../../stores/newTaskStore";
import { useSidebarStore } from "../../stores/sidebarStore";
import { areaDataAttribute } from "../life-areas/palette";
import { type Command, hitMeta, hitTarget, type PaletteRow, paletteRows } from "./commands";
import { Keys } from "./Keys";

const COMMAND_ICONS: Record<string, LucideIcon> = {
  "new-task": Plus,
  "new-event": CalendarPlus,
  home: House,
  today: Sun,
  inbox: Inbox,
  "next-7": CalendarDays,
  "all-tasks": SquareKanban,
  unscheduled: CalendarOff,
  calendar: CalendarRange,
  plan: LayoutGrid,
  projects: Folder,
  routines: Clock,
  archive: Archive,
  completed: SquareCheck,
  cancelled: SquareX,
  settings: Settings,
  sidebar: PanelLeft,
  shortcuts: Keyboard,
};

// Searching waits this long after the last key, so typing a word sends one request.
const SEARCH_DELAY_MS = 120;

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** The palette while it is open; mounted by AppLayout. */
export function CommandPaletteHost() {
  const isOpen = useCommands((state) => state.open === "palette");
  return isOpen ? <CommandPalette /> : null;
}

/**
 * Ctrl K: one field that finds any life area, project, routine or task by title and runs
 * commands (New task, Go to Today). ↑ ↓ pick a row, Enter opens it, Esc closes.
 */
function CommandPalette() {
  const close = useCommands((state) => state.close);
  const run = useRunRow();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const q = useDebounced(query.trim(), SEARCH_DELAY_MS);
  const search = useQuery({
    ...searchOptions({ query: { q, limit: 5 } }),
    enabled: q !== "",
    placeholderData: keepPreviousData,
  });
  const hits = query.trim() !== "" && q !== "" ? (search.data ?? []) : [];
  const rows = useMemo(() => paletteRows(query, hits), [query, hits]);
  const isSearching = query.trim() !== "" && (q !== query.trim() || search.isFetching);

  // A new query starts at the first row.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on each new query or result
  useEffect(() => setActive(0), [query, search.data]);
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const pick = (row: PaletteRow | undefined) => {
    if (!row) return;
    close();
    run(row);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + rows.length) % rows.length);
    } else if (event.key === "Home" && rows.length > 0) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && rows.length > 0) {
      event.preventDefault();
      setActive(rows.length - 1);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      pick(rows[active]);
    }
  };

  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(isOpen) => !isOpen && close()}
      className="bg-[rgb(17_24_39/0.32)]"
    >
      <Modal.Container placement="top" className="pt-[12vh]">
        <Modal.Dialog
          aria-label="Command palette"
          {...PANEL_OPENER}
          className="w-[560px] max-w-[calc(100vw-32px)] gap-0 overflow-hidden rounded-(--radius-12) p-0 shadow-(--effect-overlay)"
        >
          <div className="flex h-12 items-center gap-2.5 border-b border-(--border-default) px-4">
            <Search aria-hidden className="size-4 shrink-0 text-(--text-tertiary)" />
            <input
              autoFocus
              role="combobox"
              aria-label="Search or run a command"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={rows.length > 0 ? optionId(active) : undefined}
              placeholder="Search or run a command"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-(--text-primary) outline-none placeholder:text-(--text-tertiary)"
            />
            <Keys keys={["Esc"]} />
          </div>
          <Scroll
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Results"
            aria-busy={isSearching}
            className="flex max-h-[min(420px,60vh)] flex-col p-1.5"
          >
            {rows.map((row, index) => {
              const heading =
                index === 0 || rows[index - 1]?.group !== row.group ? row.group : null;
              return (
                <PaletteOption
                  key={row.key}
                  id={optionId(index)}
                  index={index}
                  row={row}
                  heading={heading}
                  isActive={index === active}
                  onHover={() => setActive(index)}
                  onPick={() => pick(row)}
                />
              );
            })}
          </Scroll>
          {rows.length === 0 && !isSearching && (
            <p className="px-4 pt-1 pb-4 type-meta text-(--text-tertiary)">No matches.</p>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PaletteOption({
  id,
  index,
  row,
  heading,
  isActive,
  onHover,
  onPick,
}: {
  id: string;
  index: number;
  row: PaletteRow;
  heading: string | null;
  isActive: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const title = row.kind === "command" ? row.command.label : row.hit.title;
  const meta = row.kind === "hit" ? hitMeta(row.hit) : "";
  const isFinished = row.kind === "hit" && row.hit.kind === "task" && row.hit.status === "done";
  return (
    <>
      {heading && (
        <div
          role="presentation"
          className="flex h-7 shrink-0 items-end px-2.5 pb-1 type-label text-(--text-tertiary) [&:not(:first-child)]:mt-1.5"
        >
          {heading}
        </div>
      )}
      {/* The input keeps focus and moves the active row (Enter picks it); a click picks one. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input handles the keys */}
      <div
        id={id}
        role="option"
        tabIndex={-1}
        aria-selected={isActive}
        data-index={index}
        onMouseMove={isActive ? undefined : onHover}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onPick}
        className={`flex h-9 shrink-0 cursor-pointer items-center gap-2.5 rounded-(--radius-6) px-2.5 ${isActive ? "bg-(--bg-hover)" : ""}`}
      >
        <span className="grid size-4 shrink-0 place-items-center">
          {row.kind === "command" ? (
            <CommandIcon command={row.command} />
          ) : (
            <HitMark hit={row.hit} />
          )}
        </span>
        <span
          className={`min-w-0 shrink truncate type-body leading-5 font-medium ${isFinished ? "text-(--text-tertiary) line-through" : "text-(--text-primary)"}`}
        >
          {title}
        </span>
        {meta && (
          <span className="min-w-0 flex-1 truncate type-meta text-(--text-tertiary)">{meta}</span>
        )}
        <span className="ml-auto flex shrink-0 items-center">
          {row.kind === "command" && row.command.keys && <Keys keys={row.command.keys} />}
        </span>
      </div>
    </>
  );
}

function CommandIcon({ command }: { command: Command }) {
  const Icon = COMMAND_ICONS[command.id] ?? Search;
  return <Icon aria-hidden className="size-4 text-(--text-tertiary)" strokeWidth={2} />;
}

/** The item's marker, as its own lists draw it: the area square, a project folder in its
 * area's colour, a routine, or a task's checkbox. */
function HitMark({ hit }: { hit: SearchHitRead }) {
  const area = areaDataAttribute(hit.life_area_color);
  switch (hit.kind) {
    case "life_area":
      return <span data-area={area} className="size-2 rounded-[2px] bg-(--area-solid)" />;
    case "project":
      return (
        <Folder
          aria-hidden
          data-area={area}
          className="size-4 text-(--area-solid)"
          strokeWidth={2}
        />
      );
    case "routine":
      return <Repeat aria-hidden className="size-4 text-(--text-tertiary)" strokeWidth={2} />;
    case "task":
      return hit.status === "done" ? (
        <span className="grid size-3.5 place-items-center rounded-[4px] bg-neutral-300 text-white">
          <Check aria-hidden className="size-2.5" strokeWidth={3} />
        </span>
      ) : (
        <span
          data-area={area}
          className={`size-3.5 rounded-[4px] border-[1.5px] ${hit.life_area_id ? "border-(--area-solid)" : "border-neutral-400"}`}
        />
      );
  }
}

/** Runs a palette row once the palette has closed. */
function useRunRow() {
  const navigate = useNavigate();
  return (row: PaletteRow) => {
    if (row.kind === "hit") {
      const target = hitTarget(row.hit);
      if (target.kind === "go") navigate(target.to);
      else useDetailPanel.getState().open({ kind: "task", id: target.id });
      return;
    }
    const action = row.command.action;
    switch (action.kind) {
      case "go":
        navigate(action.to);
        return;
      case "new-task": {
        const { open, page } = useNewTask.getState();
        open(page?.spot, page?.today ?? undefined);
        return;
      }
      case "new-event":
        useNewEvent.getState().open();
        return;
      case "toggle-sidebar": {
        const sidebar = useSidebarStore.getState();
        sidebar.setCollapsed(!sidebar.collapsed);
        return;
      }
      case "shortcuts":
        useCommands.getState().show("shortcuts");
        return;
    }
  };
}
