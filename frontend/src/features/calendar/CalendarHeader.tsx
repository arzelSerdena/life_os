import { Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../../components/IconButton";
import { useCalendarStore } from "../../stores/calendarStore";
import { MonthGrid } from "../pickers/DatePicker";
import { type CalendarView, rangeLabel, showsToday, stepAnchor, viewRange } from "./calendar";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
];

const QUARTERS = ["Jan – Mar", "Apr – Jun", "Jul – Sep", "Oct – Dec"];

/** The Year picker pages through 12 years at a time: 2021 – 2032, 2033 – 2044. */
export function yearPage(year: number): number {
  return 2021 + Math.floor((year - 2021) / 12) * 12;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Week / Month / Quarter / Year on the left, then ‹ the range › (the range opens the period
 * picker), and Today when today is out of view. No page title, no Add button.
 */
export function CalendarHeader({ anchor, today }: { anchor: string; today: string }) {
  const { view, setView, setAnchor } = useCalendarStore();
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-5 px-6">
      <ToggleButtonGroup
        aria-label="View"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[view]}
        onSelectionChange={(keys) => {
          const [selected] = keys;
          setView(selected as CalendarView);
        }}
        className="h-8 shrink-0 gap-0 rounded-(--switch-container-radius) bg-(--switch-container-bg) p-0.5"
      >
        {VIEWS.map((option) => (
          <ToggleButton
            key={option.key}
            id={option.key}
            className="h-7 min-w-0 rounded-(--switch-item-radius) bg-transparent px-3.5 text-[13px] font-medium text-(--switch-default-text) hover:bg-white/60 data-[selected=true]:bg-(--switch-active-bg) data-[selected=true]:text-(--text-primary) data-[selected=true]:shadow-(--effect-raised)"
          >
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div className="flex items-center gap-1">
        <IconButton
          label={`Previous ${view}`}
          size="md"
          onPress={() => setAnchor(stepAnchor(view, anchor, -1))}
        >
          <ChevronLeft />
        </IconButton>
        <PeriodPicker view={view} anchor={anchor} today={today} onPick={setAnchor} />
        <IconButton
          label={`Next ${view}`}
          size="md"
          onPress={() => setAnchor(stepAnchor(view, anchor, 1))}
        >
          <ChevronRight />
        </IconButton>
      </div>
      {!showsToday(view, anchor, today) && (
        <button
          type="button"
          onClick={() => setAnchor(null)}
          className="h-8 rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) px-3 text-[13px] font-medium text-(--text-primary) outline-none hover:bg-(--color-neutral-50) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        >
          Today
        </button>
      )}
    </header>
  );
}

/**
 * The range's name, which opens the picker: a week in a month grid, a month or a quarter in
 * a year, or a year in 12 years.
 */
function PeriodPicker({
  view,
  anchor,
  today,
  onPick,
}: {
  view: CalendarView;
  anchor: string;
  today: string;
  onPick: (anchor: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(anchor.slice(0, 7));
  const [year, setYear] = useState(Number(anchor.slice(0, 4)));
  const label = rangeLabel(view, anchor, today);
  const week = viewRange("week", anchor);
  const pick = (day: string) => {
    onPick(day);
    setIsOpen(false);
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) {
          setMonth(anchor.slice(0, 7));
          setYear(
            view === "year" ? yearPage(Number(anchor.slice(0, 4))) : Number(anchor.slice(0, 4)),
          );
        }
      }}
    >
      <Popover.Trigger
        aria-label={`${label}, choose a ${view}`}
        className="min-w-[132px] cursor-pointer rounded-(--radius-6) px-1.5 text-center text-[22px] leading-7 font-semibold tracking-[-0.01em] text-(--text-primary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
      >
        <span aria-live="polite">{label}</span>
      </Popover.Trigger>
      <Popover.Content
        placement="bottom start"
        className="w-[252px] rounded-[10px] border border-(--border-default) p-0"
      >
        <Popover.Dialog
          aria-label={`Choose a ${view}`}
          className="flex flex-col p-1.5 outline-none"
        >
          {view === "week" ? (
            <>
              <button
                type="button"
                onClick={() => pick(today)}
                className="flex h-[30px] items-center gap-2 rounded-(--radius-6) px-2 text-left text-[13px] font-medium text-(--text-primary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
              >
                This week
                <span className="ml-auto text-xs font-normal text-(--text-tertiary)">
                  {rangeLabel("week", today, today)}
                </span>
              </button>
              <div className="-mx-1.5 my-1.5 h-px bg-(--border-default)" />
              <MonthGrid
                month={month}
                today={today}
                selected={null}
                highlight={{ start: week.start, end: week.end }}
                onMonth={setMonth}
                onPick={pick}
              />
            </>
          ) : (
            <>
              <div className="flex h-7 items-center pr-0.5 pb-1 pl-2">
                <span className="text-[13px] font-semibold text-(--text-primary)">
                  {view === "year" ? `${year} – ${year + 11}` : year}
                </span>
                <span className="ml-auto flex gap-0.5">
                  <IconButton
                    label={view === "year" ? "Earlier years" : "Previous year"}
                    onPress={() => setYear(year - (view === "year" ? 12 : 1))}
                  >
                    <ChevronLeft />
                  </IconButton>
                  <IconButton
                    label={view === "year" ? "Later years" : "Next year"}
                    onPress={() => setYear(year + (view === "year" ? 12 : 1))}
                  >
                    <ChevronRight />
                  </IconButton>
                </span>
              </div>
              {view === "quarter" ? (
                <div className="grid grid-cols-2 gap-1.5 px-1 pb-1">
                  {QUARTERS.map((months, index) => {
                    const first = `${year}-${String(index * 3 + 1).padStart(2, "0")}-01`;
                    const shown = viewRange("quarter", anchor).start === first;
                    return (
                      <button
                        key={months}
                        type="button"
                        aria-pressed={shown}
                        aria-label={`Q${index + 1} ${year}`}
                        onClick={() => pick(first)}
                        className={`flex h-[52px] flex-col justify-center rounded-(--radius-8) border px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${
                          shown
                            ? "border-brand-600 bg-brand-100"
                            : "border-(--border-default) hover:bg-(--color-neutral-100)"
                        }`}
                      >
                        <span
                          className={`text-[13px] font-semibold ${shown ? "text-brand-700" : "text-(--text-primary)"}`}
                        >
                          Q{index + 1}
                        </span>
                        <span className="text-xs text-(--text-tertiary)">{months}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 px-1 pb-1">
                  {(view === "year"
                    ? Array.from({ length: 12 }, (_, index) => ({
                        name: String(year + index),
                        first: `${year + index}-01-01`,
                        shown: anchor.slice(0, 4) === String(year + index),
                        current: today.slice(0, 4) === String(year + index),
                      }))
                    : MONTHS.map((name, index) => {
                        const value = `${year}-${String(index + 1).padStart(2, "0")}`;
                        return {
                          name,
                          first: `${value}-01`,
                          shown: value === anchor.slice(0, 7),
                          current: value === today.slice(0, 7),
                        };
                      })
                  ).map(({ name, first, shown, current }) => (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={shown}
                      aria-current={current ? "date" : undefined}
                      onClick={() => pick(first)}
                      className={`h-9 rounded-(--radius-8) border text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${
                        shown
                          ? "border-brand-600 bg-brand-100 font-semibold text-brand-700"
                          : current
                            ? "border-brand-500 text-brand-700 shadow-[inset_0_0_0_1px_var(--color-brand-500)] hover:bg-(--color-neutral-100)"
                            : "border-(--border-default) text-(--text-primary) hover:bg-(--color-neutral-100)"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
