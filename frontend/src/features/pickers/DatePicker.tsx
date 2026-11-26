import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
  Sun,
  Sunrise,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { today as localToday } from "../../period";
import { type ChipTone, PickerRow, PickerSeparator, PopoverChip, PopoverField } from "./chips";
import {
  addDays,
  addMonths,
  dayDate,
  longDate,
  monthGrid,
  monthTitle,
  nextMonday,
  parseDate,
  relativeName,
} from "./dates";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * A form field that opens the date picker, so every date in a form uses the same Monday-first
 * picker instead of the browser's own (whose week start follows the system's locale).
 * An empty value is "": `placeholder` shows, and `clearLabel` adds the row that clears it.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  today = localToday(),
  placeholder = "Pick a date",
  clearLabel,
  isInvalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  today?: string;
  placeholder?: string;
  clearLabel?: string;
  isInvalid?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <PopoverField
      icon={CalendarDays}
      label={label}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      isPlaceholder={!value}
      isInvalid={isInvalid}
      value={value ? dayDate(value) : placeholder}
    >
      <DatePanel
        value={value || null}
        today={today}
        clearLabel={clearLabel}
        onPick={(next) => {
          setIsOpen(false);
          if ((next ?? "") !== value) onChange(next ?? "");
        }}
      />
    </PopoverField>
  );
}

/**
 * The date picker (Approved: Pickers, as changed by Approved: Tasks): a typed date field, then
 * Today, Tomorrow and Next week as icon buttons (the date shows on hover), then the month.
 * Typing ("fri", "nov 20", "+3d") shows the match as one row and outlines it on the grid.
 * With a date set, a last row clears it ("No due date").
 */
export function DatePanel({
  value,
  today,
  clearLabel,
  onPick,
}: {
  value: string | null;
  today: string;
  /** The row that clears the date, shown while one is set. */
  clearLabel?: string;
  onPick: (value: string | null) => void;
}) {
  const shown = value ? longDate(value) : "";
  const [text, setText] = useState(shown);
  const typed = text.trim() !== "" && text !== shown;
  const match = typed ? parseDate(text, today) : null;
  const [month, setMonth] = useState((value ?? today).slice(0, 7));
  // While typing, the grid follows the match.
  const visible = match ? match.slice(0, 7) : month;
  const quick: { icon: LucideIcon; name: string; date: string }[] = [
    { icon: Sun, name: "Today", date: today },
    { icon: Sunrise, name: "Tomorrow", date: addDays(today, 1) },
    { icon: CalendarRange, name: "Next week", date: nextMonday(today) },
  ];

  return (
    <>
      <div className="px-0.5 pt-0.5 pb-1.5">
        <label className="flex h-8 items-center gap-1.5 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 focus-within:border-(--color-brand-600) focus-within:shadow-[0_0_0_2px_var(--color-brand-200)]">
          <CalendarDays aria-hidden className="size-3.5 shrink-0 text-(--text-tertiary)" />
          <input
            // biome-ignore lint/a11y/noAutofocus: the picker opens to type a date
            autoFocus
            aria-label="Date"
            placeholder="Pick a date"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (match) onPick(match);
                else if (clearLabel && text.trim() === "" && value) onPick(null);
              }
            }}
            className="min-w-0 flex-1 bg-transparent type-body text-(--text-primary) outline-none placeholder:text-(--text-tertiary)"
          />
        </label>
      </div>

      {match ? (
        <PickerRow
          leading={<CalendarDays aria-hidden className="size-3.5 text-(--text-tertiary)" />}
          note={dayDate(match)}
          onPress={() => onPick(match)}
        >
          {relativeName(match, today)}
        </PickerRow>
      ) : (
        <div className="flex gap-1.5 px-0.5">
          {quick.map(({ icon: Icon, name, date }) => (
            <button
              key={name}
              type="button"
              aria-label={`${name} · ${dayDate(date)}`}
              title={`${name} · ${dayDate(date)}`}
              onClick={() => onPick(date)}
              className="grid h-[30px] flex-1 place-items-center rounded-(--radius-6) border border-(--border-default) text-(--text-secondary) outline-none hover:bg-(--color-neutral-100) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
            >
              <Icon aria-hidden className="size-[15px]" strokeWidth={2} />
            </button>
          ))}
        </div>
      )}

      <PickerSeparator />
      <MonthGrid
        month={visible}
        today={today}
        selected={value}
        outlined={match}
        onMonth={(next) => {
          setMonth(next);
          if (typed) setText(shown);
        }}
        onPick={onPick}
      />

      {value && clearLabel && (
        <>
          <PickerSeparator />
          <PickerRow
            leading={<X aria-hidden className="size-3.5 text-(--text-tertiary)" />}
            onPress={() => onPick(null)}
          >
            {clearLabel}
          </PickerRow>
        </>
      )}
    </>
  );
}

/** The shared month grid: Monday first, 32 px columns; today ringed, the chosen day filled. */
export function MonthGrid({
  month,
  today,
  selected,
  outlined,
  highlight,
  onMonth,
  onPick,
}: {
  month: string;
  today: string;
  selected: string | null;
  /** The day a typed date matches. */
  outlined?: string | null;
  /** Days shaded as one range, such as the Calendar's shown week. */
  highlight?: { start: string; end: string };
  onMonth: (month: string) => void;
  onPick: (date: string) => void;
}) {
  return (
    <div className="px-1.5 pt-1 pb-0.5">
      <div className="flex h-7 items-center pr-0.5 pl-1">
        <span className="type-body font-semibold text-(--text-primary)">{monthTitle(month)}</span>
        <span className="ml-auto flex gap-0.5">
          <NavButton label="Previous month" onPress={() => onMonth(addMonths(month, -1))}>
            <ChevronLeft aria-hidden className="size-3.5" />
          </NavButton>
          <NavButton label="Next month" onPress={() => onMonth(addMonths(month, 1))}>
            <ChevronRight aria-hidden className="size-3.5" />
          </NavButton>
        </span>
      </div>
      <div className="grid grid-cols-[repeat(7,32px)]">
        <div aria-hidden className="contents">
          {WEEKDAY_LETTERS.map((letter, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: the letters repeat
              key={index}
              className="grid h-7 place-items-center type-tag font-medium text-(--text-tertiary)"
            >
              {letter}
            </span>
          ))}
        </div>
        {monthGrid(month).map((week) => (
          <div key={week[0]} className="contents">
            {week.map((date) => {
              const isSelected = date === selected;
              const isToday = date === today;
              const inMonth = date.slice(0, 7) === month;
              const inRange = !!highlight && highlight.start <= date && date <= highlight.end;
              return (
                <span key={date} className="grid h-[30px] place-items-center">
                  <button
                    type="button"
                    aria-label={longDate(date)}
                    aria-pressed={isSelected || inRange}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => onPick(date)}
                    className={`grid size-7 place-items-center rounded-(--radius-6) text-xs outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${
                      isSelected
                        ? "bg-(--color-brand-600) font-semibold text-white"
                        : date === outlined
                          ? "bg-(--color-brand-100) text-(--text-primary) shadow-[inset_0_0_0_1px_var(--color-brand-600)]"
                          : inRange
                            ? `bg-(--color-brand-100) font-semibold text-(--color-brand-700) ${isToday ? "shadow-[inset_0_0_0_1px_var(--color-brand-500)]" : ""}`
                            : isToday
                              ? "font-semibold text-(--color-brand-700) shadow-[inset_0_0_0_1px_var(--color-brand-500)] hover:bg-(--color-neutral-100)"
                              : `hover:bg-(--color-neutral-100) ${
                                  inMonth ? "text-(--text-primary)" : "text-(--text-disabled)"
                                }`
                    }`}
                  >
                    {Number(date.slice(8))}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function NavButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className="grid size-6 place-items-center rounded-(--radius-6) text-(--text-tertiary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
    >
      {children}
    </button>
  );
}

/** A chip that picks a date with the date picker, or clears it. */
export function DateChip({
  icon,
  tone = "default",
  label,
  value,
  today,
  clearLabel,
  onChange,
  children,
}: {
  icon?: LucideIcon;
  tone?: ChipTone;
  label: string;
  value: string | null;
  /** Defaults to the device's date. */
  today?: string;
  clearLabel?: string;
  onChange: (value: string | null) => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <PopoverChip
      icon={icon}
      tone={tone}
      label={label}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      chip={children}
    >
      <DatePanel
        value={value}
        today={today ?? localToday()}
        clearLabel={clearLabel}
        onPick={(next) => {
          setIsOpen(false);
          if (next !== value) onChange(next);
        }}
      />
    </PopoverChip>
  );
}
