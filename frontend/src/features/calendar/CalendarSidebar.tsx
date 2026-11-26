import { Check, Flag, Inbox, List } from "lucide-react";
import type { ReactNode } from "react";
import type { LifeAreaRead } from "../../client/types.gen";
import { Scroll } from "../../components/Scroll";
import { SIDEBAR_ROW, SIDEBAR_ROW_ACTIVE, Sidebar } from "../../components/Sidebar";
import { type CalendarPanel, useCalendarStore } from "../../stores/calendarStore";
import { areaDataAttribute } from "../life-areas/palette";
import type { Priority } from "../tasks/board";
import { type CalendarFilters, type CalendarView, isLinear, type ShowKey } from "./calendar";

/** SHOW follows the view: Quarter and Year have no routines, and projects show as bars. */
function showOptions(view: CalendarView): { key: ShowKey; label: string }[] {
  const linear = isLinear(view);
  return [
    { key: "events", label: "Events" },
    { key: "tasks", label: "Tasks" },
    ...(linear ? [] : [{ key: "routines" as const, label: "Routine steps" }]),
    { key: "projects", label: linear ? "Projects" : "Project due dates" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
    { key: "weekends", label: "Weekends" },
  ];
}

const PRIORITIES: { key: Priority; label: string; flag: string }[] = [
  { key: "high", label: "High", flag: "text-(--priority-high)" },
  { key: "medium", label: "Medium", flag: "text-(--priority-medium)" },
  { key: "low", label: "Low", flag: "text-(--priority-low)" },
  { key: "none", label: "None", flag: "text-(--text-tertiary)" },
];

/**
 * The Calendar's sidebar is its filter menu: which panel shows on the right (Agenda or
 * Inbox), then which life areas, kinds and priorities the grid and agenda show.
 */
export function CalendarSidebar({
  lifeAreas,
  inboxCount,
  view,
}: {
  lifeAreas: readonly LifeAreaRead[];
  inboxCount: number | undefined;
  view: CalendarView;
}) {
  const { panel, setPanel, filters, setFilters } = useCalendarStore();
  const toggleIn = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const set = (change: Partial<CalendarFilters>) => setFilters({ ...filters, ...change });

  const allAreaKeys: (number | "none")[] = [...lifeAreas.map((a) => a.id), "none"];
  const soloArea = (target: number | "none") => {
    const others = allAreaKeys.filter((k) => k !== target);
    const alreadySolo =
      !filters.hiddenAreas.includes(target) && others.every((k) => filters.hiddenAreas.includes(k));
    set({ hiddenAreas: alreadySolo ? [] : others });
  };

  const showItems = showOptions(view);
  const kindKeys: ShowKey[] = showItems
    .map((o) => o.key)
    .filter((k) => k === "events" || k === "tasks" || k === "routines" || k === "projects");
  const soloShow = (target: ShowKey) => {
    if (!kindKeys.includes(target)) {
      set({ show: { ...filters.show, [target]: !filters.show[target] } });
      return;
    }
    const alreadySolo =
      filters.show[target] && kindKeys.every((k) => k === target || !filters.show[k]);
    const nextShow = { ...filters.show };
    for (const k of kindKeys) {
      nextShow[k] = alreadySolo ? true : k === target;
    }
    set({ show: nextShow });
  };

  const allPriorities = PRIORITIES.map((p) => p.key);
  const soloPriority = (target: Priority) => {
    const others = allPriorities.filter((k) => k !== target);
    const alreadySolo =
      !filters.hiddenPriorities.includes(target) &&
      others.every((k) => filters.hiddenPriorities.includes(k));
    set({ hiddenPriorities: alreadySolo ? [] : others });
  };

  return (
    <Sidebar label="Calendar">
      <Scroll className="flex min-h-0 flex-1 flex-col pb-10">
        <Group title="Panel">
          <PanelRow
            panel="agenda"
            current={panel}
            onPick={setPanel}
            icon={<List />}
            label="Agenda"
          />
          <PanelRow
            panel="inbox"
            current={panel}
            onPick={setPanel}
            icon={<Inbox />}
            label="Inbox"
            count={inboxCount}
          />
        </Group>
        <Divider />
        <Group title="Life areas">
          {lifeAreas.map((area) => (
            <FilterRow
              key={area.id}
              label={area.title}
              color={area.color}
              checked={!filters.hiddenAreas.includes(area.id)}
              onChange={() => set({ hiddenAreas: toggleIn(filters.hiddenAreas, area.id) })}
              onSolo={() => soloArea(area.id)}
            />
          ))}
          <FilterRow
            label="No area"
            color={null}
            checked={!filters.hiddenAreas.includes("none")}
            onChange={() => set({ hiddenAreas: toggleIn(filters.hiddenAreas, "none" as const) })}
            onSolo={() => soloArea("none")}
          />
        </Group>
        <Divider />
        <Group title="Show">
          {showItems.map(({ key, label }) => (
            <FilterRow
              key={key}
              label={label}
              checked={filters.show[key]}
              onChange={() => set({ show: { ...filters.show, [key]: !filters.show[key] } })}
              onSolo={() => soloShow(key)}
            />
          ))}
        </Group>
        <Divider />
        <Group title="Priority">
          {PRIORITIES.map(({ key, label, flag }) => (
            <FilterRow
              key={key}
              label={label}
              icon={<Flag aria-hidden className={`size-[13px] shrink-0 ${flag}`} strokeWidth={2} />}
              checked={!filters.hiddenPriorities.includes(key)}
              onChange={() => set({ hiddenPriorities: toggleIn(filters.hiddenPriorities, key) })}
              onSolo={() => soloPriority(key)}
            />
          ))}
        </Group>
      </Scroll>
    </Sidebar>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = `calendar-group-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-(--sidebar-item-gap)">
      <h2
        id={id}
        className="flex h-7 items-center pl-2 type-body font-semibold tracking-[0.04em] text-(--text-primary) uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="my-(--sidebar-divider-space) h-px shrink-0 bg-(--sidebar-divider)" />;
}

function PanelRow({
  panel,
  current,
  onPick,
  icon,
  label,
  count,
}: {
  panel: CalendarPanel;
  current: CalendarPanel | null;
  onPick: (panel: CalendarPanel) => void;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  const active = current === panel;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onPick(panel)}
      className={`${SIDEBAR_ROW} ${active ? SIDEBAR_ROW_ACTIVE : "text-(--sidebar-item-text)"} text-left [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-2`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-(--text-tertiary) tabular-nums">{count}</span>
      )}
    </button>
  );
}

/** A checkbox row; area rows fill the box with the area colour, the rest with the accent. */
function FilterRow({
  label,
  checked,
  onChange,
  onSolo,
  color,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  onSolo: () => void;
  /** An area's palette key (null: No area, grey); leave out for the accent. */
  color?: string | null;
  icon?: ReactNode;
}) {
  const box =
    color === undefined
      ? "checked:border-brand-600 checked:bg-brand-600"
      : color === null
        ? "checked:border-(--color-neutral-400) checked:bg-(--color-neutral-400)"
        : "checked:border-(--area-solid) checked:bg-(--area-solid)";
  return (
    <div
      data-area={color === undefined ? undefined : areaDataAttribute(color)}
      className="flex h-[30px] items-center gap-2.5 rounded-(--radius-6) px-2.5 type-body text-(--text-primary) hover:bg-(--sidebar-item-hover)"
    >
      <label className="relative grid size-[15px] shrink-0 cursor-pointer place-items-center">
        <input
          type="checkbox"
          aria-label={`Show ${label}`}
          checked={checked}
          onChange={onChange}
          className={`peer size-[15px] cursor-pointer appearance-none rounded-[4px] border-[1.5px] border-(--border-strong) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${box}`}
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3.5}
        />
      </label>
      <button
        type="button"
        onClick={onSolo}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:underline"
      >
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </button>
    </div>
  );
}
