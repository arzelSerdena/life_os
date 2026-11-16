import { Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../../components/IconButton";
import { useCalendarStore } from "../../stores/calendarStore";
import { MonthGrid } from "../pickers/DatePicker";
import { type CalendarView, rangeLabel, showsToday, stepAnchor, viewRange } from "./calendar";

const VIEWS: { key: CalendarView | "quarter" | "year"; label: string; built: boolean }[] = [
  { key: "week", label: "Week", built: true },
  { key: "month", label: "Month", built: true },
  { key: "quarter", label: "Quarter", built: false },
  { key: "year", label: "Year", built: false },
];

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
            isDisabled={!option.built}
            aria-label={option.built ? option.label : `${option.label} (not built yet)`}
            className="h-7 min-w-0 rounded-(--switch-item-radius) bg-transparent px-3.5 text-[13px] font-medium text-(--switch-default-text) hover:bg-white/60 disabled:opacity-50 data-[selected=true]:bg-(--switch-active-bg) data-[selected=true]:text-(--text-primary) data-[selected=true]:shadow-(--effect-raised)"
          >
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div className="flex items-center gap-1">
        <IconButton
          label={view === "week" ? "Previous week" : "Previous month"}
          size="md"
          onPress={() => setAnchor(stepAnchor(view, anchor, -1))}
        >
          <ChevronLeft />
        </IconButton>
        <PeriodPicker view={view} anchor={anchor} today={today} onPick={setAnchor} />
        <IconButton
          label={view === "week" ? "Next week" : "Next month"}
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

/** The range's name, which opens the picker: a week in a month grid, or a month in a year. */
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
          setYear(Number(anchor.slice(0, 4)));
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
                <span className="text-[13px] font-semibold text-(--text-primary)">{year}</span>
                <span className="ml-auto flex gap-0.5">
                  <IconButton label="Previous year" onPress={() => setYear(year - 1)}>
                    <ChevronLeft />
                  </IconButton>
                  <IconButton label="Next year" onPress={() => setYear(year + 1)}>
                    <ChevronRight />
                  </IconButton>
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 px-1 pb-1">
                {MONTHS.map((name, index) => {
                  const value = `${year}-${String(index + 1).padStart(2, "0")}`;
                  const shown = value === anchor.slice(0, 7);
                  const current = value === today.slice(0, 7);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={shown}
                      aria-current={current ? "date" : undefined}
                      onClick={() => pick(`${value}-01`)}
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
                  );
                })}
              </div>
            </>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
