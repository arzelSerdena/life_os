import { Check, Flag, Inbox, List } from "lucide-react";
import type { ReactNode } from "react";
import type { LifeAreaRead } from "../../client/types.gen";
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

const PRIORITIES: { key: Priority; label: string; flag: string | null }[] = [
  { key: "high", label: "High", flag: "text-(--priority-high)" },
  { key: "medium", label: "Medium", flag: "text-(--priority-medium)" },
  { key: "low", label: "Low", flag: "text-(--priority-low)" },
  { key: "none", label: "None", flag: null },
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

  return (
    <Sidebar label="Calendar">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-10">
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
            />
          ))}
          <FilterRow
            label="No area"
            color={null}
            checked={!filters.hiddenAreas.includes("none")}
            onChange={() => set({ hiddenAreas: toggleIn(filters.hiddenAreas, "none" as const) })}
          />
        </Group>
        <Divider />
        <Group title="Show">
          {showOptions(view).map(({ key, label }) => (
            <FilterRow
              key={key}
              label={label}
              checked={filters.show[key]}
              onChange={() => set({ show: { ...filters.show, [key]: !filters.show[key] } })}
            />
          ))}
        </Group>
        <Divider />
        <Group title="Priority">
          {PRIORITIES.map(({ key, label, flag }) => (
            <FilterRow
              key={key}
              label={label}
              icon={
                flag ? (
                  <Flag aria-hidden className={`size-[13px] shrink-0 ${flag}`} strokeWidth={2} />
                ) : (
                  <span aria-hidden className="w-[13px] shrink-0" />
                )
              }
              checked={!filters.hiddenPriorities.includes(key)}
              onChange={() => set({ hiddenPriorities: toggleIn(filters.hiddenPriorities, key) })}
            />
          ))}
        </Group>
      </div>
    </Sidebar>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = `calendar-group-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-(--sidebar-item-gap)">
      <h2
        id={id}
        className="flex h-7 items-center pl-2 text-[13px] leading-[18px] font-semibold tracking-[0.04em] text-(--text-primary) uppercase"
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
  color,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
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
    <label
      data-area={color === undefined ? undefined : areaDataAttribute(color)}
      className="flex h-[30px] cursor-pointer items-center gap-2.5 rounded-(--radius-6) px-2.5 text-[13px] text-(--text-primary) hover:bg-(--sidebar-item-hover)"
    >
      <span className="relative grid size-[15px] shrink-0 place-items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className={`peer size-[15px] cursor-pointer appearance-none rounded-[4px] border-[1.5px] border-(--color-neutral-400) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${box}`}
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute size-2.5 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}
