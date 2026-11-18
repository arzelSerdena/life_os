import { Button, Dropdown, Label, Popover } from "@heroui/react";
import { Check, ChevronDown, Flag, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import type { LifeAreaRead, SectionRead } from "../../client/types.gen";
import { useTaskBoard } from "../../stores/taskBoardStore";
import { areaDataAttribute } from "../life-areas/palette";
import { orderedSections, PRIORITIES, type Priority } from "./board";
import {
  type AreaKey,
  type Filters,
  type FilterView,
  filtersOn,
  type Layout,
  resolveFilters,
  type SectionKey,
  SHOW_LABELS,
  type ShowKey,
  SORT_LABELS,
  type SortKey,
  SUBGROUP_LABELS,
  type SubgroupKey,
  VIEW_MENUS,
} from "./filters";

/** A view's filter-and-sort choices, with the defaults filled in. */
export function useViewFilters(view: FilterView, layout: Layout): Filters {
  const stored = useTaskBoard((state) => state.filters[view]);
  return resolveFilters(view, layout, stored);
}

/** Clears a view's Priority, Section, Life areas and Show filters; sort and subgroup stay. */
export function useClearFilters(view: FilterView): () => void {
  const setFilters = useTaskBoard((state) => state.setFilters);
  return () => setFilters(view, ({ sort, subgroups }) => ({ sort, subgroups }));
}

const PRIORITY_FLAG: Record<Priority, string> = {
  high: "text-(--priority-high)",
  medium: "text-(--priority-medium)",
  low: "text-(--priority-low)",
  none: "",
};

/**
 * The header's filter-and-sort icon (with an accent dot while filters hide something) and its
 * menu: Subgroup and Sort by, then the PRIORITY, LIFE AREAS and SHOW checkboxes, then Clear
 * filters. Changes apply at once and the menu stays open (approved-tasks.html, "Filter and sort").
 */
export function FilterMenu({
  view,
  layout,
  lifeAreas,
  sections = [],
}: {
  view: FilterView;
  layout: Layout;
  lifeAreas: readonly LifeAreaRead[];
  /** A project board's sections, for its Section filter. */
  sections?: readonly SectionRead[];
}) {
  const menu = VIEW_MENUS[view];
  const filters = useViewFilters(view, layout);
  const setFilters = useTaskBoard((state) => state.setFilters);
  const clear = useClearFilters(view);
  const on = filtersOn(view, filters);
  const subgroups = menu.subgroups[layout] ?? [];
  const showKeys = Object.keys(menu.show) as ShowKey[];

  const toggle = <K,>(list: K[], key: K) =>
    list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
  const areaRows: { key: AreaKey; label: string; color: string | null }[] = [
    ...(menu.areas === "with-no-area"
      ? [{ key: "none" as const, label: "No area", color: null }]
      : []),
    ...lifeAreas.map((area) => ({ key: area.id, label: area.title, color: area.color })),
  ];
  const sectionRows: { key: SectionKey; label: string }[] = [
    { key: "none", label: "No section" },
    ...orderedSections(sections).map((section) => ({ key: section.id, label: section.title })),
  ];

  return (
    <Popover>
      <Popover.Trigger
        aria-label={on ? "Filter and sort (filters on)" : "Filter and sort"}
        className="relative grid size-7 shrink-0 place-items-center rounded-(--radius-6) text-(--text-tertiary) outline-none hover:bg-(--color-neutral-100) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus-ring) data-[pressed=true]:bg-(--color-neutral-100) aria-expanded:bg-(--color-neutral-100) aria-expanded:text-(--text-primary)"
      >
        <SlidersHorizontal aria-hidden className="size-4" strokeWidth={2} />
        {on && (
          <span
            aria-hidden
            className="absolute top-[3px] right-[3px] size-[7px] rounded-full bg-(--color-brand-700) shadow-[0_0_0_2px_var(--bg-surface)]"
          />
        )}
      </Popover.Trigger>
      <Popover.Content placement="bottom end" className="w-[280px]">
        <Popover.Dialog
          aria-label="Filter and sort"
          className="flex max-h-[min(640px,80vh)] flex-col overflow-y-auto p-1.5"
        >
          {subgroups.length > 1 && (
            <ChoiceRow
              label="Subgroup"
              value={filters.subgroup}
              options={subgroups.map((key) => ({ key, label: SUBGROUP_LABELS[key] }))}
              onChange={(key: SubgroupKey) =>
                setFilters(view, (current) => ({
                  ...current,
                  subgroups: { ...current.subgroups, [layout]: key },
                }))
              }
            />
          )}
          {menu.sorts.length > 1 && (
            <ChoiceRow
              label="Sort by"
              value={filters.sort}
              options={menu.sorts.map((key) => ({ key, label: SORT_LABELS[key] }))}
              onChange={(key: SortKey) =>
                setFilters(view, (current) => ({ ...current, sort: key }))
              }
            />
          )}

          <Section label="Priority" first={subgroups.length <= 1 && menu.sorts.length <= 1}>
            {PRIORITIES.map(({ key, label }) => (
              <CheckRow
                key={key}
                label={label}
                checked={!filters.hiddenPriorities.includes(key)}
                onChange={() =>
                  setFilters(view, (current) => ({
                    ...current,
                    hiddenPriorities: toggle(filters.hiddenPriorities, key),
                  }))
                }
              >
                {key === "none" ? (
                  <span aria-hidden className="size-[13px] shrink-0" />
                ) : (
                  <Flag
                    aria-hidden
                    className={`size-[13px] shrink-0 ${PRIORITY_FLAG[key]}`}
                    strokeWidth={2}
                  />
                )}
              </CheckRow>
            ))}
          </Section>

          {menu.sections && (
            <Section label="Section">
              {sectionRows.map((row) => (
                <CheckRow
                  key={row.key}
                  label={row.label}
                  checked={!filters.hiddenSections.includes(row.key)}
                  onChange={() =>
                    setFilters(view, (current) => ({
                      ...current,
                      hiddenSections: toggle(filters.hiddenSections, row.key),
                    }))
                  }
                />
              ))}
            </Section>
          )}

          {menu.areas && (
            <Section label="Life areas">
              {areaRows.map((row) => (
                <CheckRow
                  key={row.key}
                  label={row.label}
                  checked={!filters.hiddenAreas.includes(row.key)}
                  onChange={() =>
                    setFilters(view, (current) => ({
                      ...current,
                      hiddenAreas: toggle(filters.hiddenAreas, row.key),
                    }))
                  }
                >
                  <span
                    aria-hidden
                    data-area={areaDataAttribute(row.color)}
                    className="size-[9px] shrink-0 rounded-[2px] bg-(--area-solid)"
                  />
                </CheckRow>
              ))}
            </Section>
          )}

          {showKeys.length > 0 && (
            <Section label="Show">
              {showKeys.map((key) => (
                <CheckRow
                  key={key}
                  label={SHOW_LABELS[key]}
                  checked={filters.show[key]}
                  onChange={() =>
                    setFilters(view, (current) => ({
                      ...current,
                      show: { ...current.show, [key]: !filters.show[key] },
                    }))
                  }
                />
              ))}
            </Section>
          )}

          {on && (
            <>
              <div className="mx-1 my-1.5 h-px shrink-0 bg-(--border-default)" />
              <button
                type="button"
                onClick={clear}
                className="flex h-[30px] shrink-0 items-center gap-2 rounded-(--radius-6) px-2 text-left text-[13px] text-(--text-primary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
              >
                <X aria-hidden className="size-[13px] text-(--text-tertiary)" strokeWidth={2} />
                Clear filters
              </button>
            </>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function Section({
  label,
  first = false,
  children,
}: {
  label: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 shrink-0 flex-col">
      {!first && <div className="mx-1 my-1.5 h-px bg-(--border-default)" />}
      <legend className="contents">
        <span className="block px-2 pt-1 pb-0.5 text-[11px] leading-4 font-semibold tracking-[0.04em] text-(--text-tertiary) uppercase">
          {label}
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

/** A checkbox row: neutral-700 when checked, as in every menu (Nov 16). */
function CheckRow({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  children?: ReactNode;
}) {
  return (
    <label className="flex h-[30px] shrink-0 cursor-pointer items-center gap-2 rounded-(--radius-6) px-2 text-[13px] text-(--text-primary) hover:bg-(--color-neutral-100) has-focus-visible:ring-2 has-focus-visible:ring-(--focus-ring)">
      <span className="relative grid size-6 shrink-0 place-items-center -m-[4.5px]">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer size-[15px] cursor-pointer appearance-none rounded-[4px] border-[1.5px] border-(--color-neutral-400) outline-none checked:border-(--color-neutral-700) checked:bg-(--color-neutral-700)"
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute hidden size-2.5 text-white peer-checked:block"
          strokeWidth={3}
        />
      </span>
      {children}
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

/** "Subgroup [Area ▾]": a label and a 150 px field that opens the choices. */
function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (key: T) => void;
}) {
  const current = options.find((option) => option.key === value)?.label ?? "";
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 px-2">
      <span className="text-[13px] text-(--text-secondary)">{label}</span>
      <Dropdown>
        <Button
          aria-label={`${label}: ${current}`}
          className="h-[30px] w-[150px] min-w-0 justify-between rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 text-[13px] font-normal text-(--text-primary) hover:bg-(--color-neutral-50)"
        >
          {current}
          <ChevronDown aria-hidden className="size-3 text-(--text-tertiary)" strokeWidth={2} />
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-[150px]">
          <Dropdown.Menu
            aria-label={label}
            selectionMode="single"
            selectedKeys={[value]}
            onAction={(key) => onChange(String(key) as T)}
          >
            {options.map((option) => (
              <Dropdown.Item
                key={option.key}
                id={option.key}
                textValue={option.label}
                className="group"
              >
                <Label className="flex-1">{option.label}</Label>
                <Check
                  aria-hidden
                  className="invisible size-3.5 text-(--text-tertiary) group-data-[selected=true]:visible"
                  strokeWidth={2}
                />
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
