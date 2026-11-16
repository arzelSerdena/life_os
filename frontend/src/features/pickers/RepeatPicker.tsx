import { Button } from "@heroui/react";
import { ChevronRight, Repeat } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SegmentSwitch } from "../../components/SegmentSwitch";
import { PickerRow, PickerSeparator, PopoverChip, PopoverField } from "./chips";
import { addDays, longDate, parseDate, WEEKDAY_NAMES } from "./dates";
import {
  describeRepeat,
  type Frequency,
  presetOf,
  presets,
  type RepeatRule,
  simpleRule,
} from "./repeat";

/**
 * The Repeat chip: Does not repeat, the presets taken from the item's date, then Custom ›
 * (Every n unit, On weekdays, From schedule or completion, Ends). Picking a row applies it;
 * only Custom has Cancel and Done.
 */
export function RepeatChip({
  value,
  anchor,
  allowCompletion = true,
  onChange,
}: {
  value: RepeatRule | null;
  /** The item's date, which the presets and months take their day from. */
  anchor: string;
  /** Tasks can repeat from completion; other items only from the schedule. */
  allowCompletion?: boolean;
  onChange: (rule: RepeatRule | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  return (
    <PopoverChip
      icon={Repeat}
      tone={value ? "default" : "ghost"}
      label="Repeat"
      width={custom ? 320 : 260}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) setCustom(false);
        setIsOpen(open);
      }}
      chip={<span className="truncate">{value ? describeRepeat(value, anchor) : "Repeat"}</span>}
    >
      <RepeatPanel
        value={value}
        anchor={anchor}
        allowCompletion={allowCompletion}
        custom={custom}
        onCustom={() => setCustom(true)}
        onCancel={() => setIsOpen(false)}
        onPick={(rule) => {
          setIsOpen(false);
          onChange(rule);
        }}
      />
    </PopoverChip>
  );
}

/** The Repeat field, as in New event: the same picker under a form field. */
export function RepeatField({
  value,
  anchor,
  onChange,
}: {
  value: RepeatRule | null;
  anchor: string;
  onChange: (rule: RepeatRule | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  return (
    <PopoverField
      icon={Repeat}
      label="Repeat"
      width={custom ? 320 : 260}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) setCustom(false);
        setIsOpen(open);
      }}
      value={value ? describeRepeat(value, anchor) : "Does not repeat"}
    >
      <RepeatPanel
        value={value}
        anchor={anchor}
        allowCompletion={false}
        custom={custom}
        onCustom={() => setCustom(true)}
        onCancel={() => setIsOpen(false)}
        onPick={(rule) => {
          setIsOpen(false);
          onChange(rule);
        }}
      />
    </PopoverField>
  );
}

/** The Repeat picker's body: the presets, or Custom once it is opened. */
function RepeatPanel({
  value,
  anchor,
  allowCompletion,
  custom,
  onCustom,
  onCancel,
  onPick,
}: {
  value: RepeatRule | null;
  anchor: string;
  allowCompletion: boolean;
  custom: boolean;
  onCustom: () => void;
  onCancel: () => void;
  onPick: (rule: RepeatRule | null) => void;
}) {
  const current = value ? presetOf(value, anchor) : null;
  if (custom) {
    return (
      <CustomRepeat
        initial={value ?? simpleRule("weekly", anchor)}
        anchor={anchor}
        allowCompletion={allowCompletion}
        onCancel={onCancel}
        onDone={onPick}
      />
    );
  }
  return (
    <>
      <PickerRow selected={value === null} onPress={() => onPick(null)}>
        Does not repeat
      </PickerRow>
      <PickerSeparator />
      {presets(anchor).map((preset) => (
        <PickerRow
          key={preset.id}
          note={preset.note || undefined}
          selected={current === preset.id}
          onPress={() => onPick(preset.rule)}
        >
          {preset.label}
        </PickerRow>
      ))}
      <PickerSeparator />
      <PickerRow
        selected={value !== null && current === null}
        note={<ChevronRight aria-hidden className="size-3.5" />}
        onPress={onCustom}
      >
        Custom
      </PickerRow>
    </>
  );
}

const UNITS: { key: Frequency; one: string; many: string }[] = [
  { key: "daily", one: "day", many: "days" },
  { key: "weekly", one: "week", many: "weeks" },
  { key: "monthly", one: "month", many: "months" },
  { key: "yearly", one: "year", many: "years" },
];

const FIELD =
  "h-7 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2 text-[13px] text-(--text-primary) outline-none focus:border-(--color-brand-600) focus:shadow-[0_0_0_2px_var(--color-brand-200)]";

function CustomRepeat({
  initial,
  anchor,
  allowCompletion,
  onCancel,
  onDone,
}: {
  initial: RepeatRule;
  anchor: string;
  allowCompletion: boolean;
  onCancel: () => void;
  onDone: (rule: RepeatRule) => void;
}) {
  const [rule, setRule] = useState(initial);
  const [endText, setEndText] = useState(
    longDate(initial.ends.kind === "on" ? initial.ends.date : addDays(anchor, 91)),
  );
  const [countText, setCountText] = useState(
    String(initial.ends.kind === "after" ? initial.ends.count : 10),
  );
  const endDate = parseDate(endText, anchor);
  const count = Number(countText);
  const interval = Math.max(1, rule.interval);
  const ends =
    rule.ends.kind === "on"
      ? endDate && endDate >= anchor
        ? ({ kind: "on", date: endDate } as const)
        : null
      : rule.ends.kind === "after"
        ? Number.isInteger(count) && count >= 1 && count <= 999
          ? ({ kind: "after", count } as const)
          : null
        : rule.ends;
  const result: RepeatRule | null = ends ? { ...rule, interval, ends } : null;

  const toggleDay = (index: number) => {
    const has = rule.weekdays.includes(index);
    const weekdays = has ? rule.weekdays.filter((d) => d !== index) : [...rule.weekdays, index];
    // At least one day stays on.
    if (weekdays.length > 0) setRule({ ...rule, weekdays: weekdays.sort((a, b) => a - b) });
  };

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[52px_1fr] items-center gap-x-2 gap-y-2.5 px-2 pt-2 pb-3">
        <Label>Every</Label>
        <div className="flex gap-1.5">
          <input
            aria-label="Every"
            inputMode="numeric"
            value={rule.interval || ""}
            onChange={(event) =>
              setRule({
                ...rule,
                interval: Math.min(99, Number(event.target.value.replace(/\D/g, ""))),
              })
            }
            className={`${FIELD} w-14 text-center`}
          />
          <select
            aria-label="Unit"
            value={rule.frequency}
            onChange={(event) => {
              const frequency = event.target.value as Frequency;
              const next = simpleRule(frequency, anchor);
              setRule({ ...rule, frequency, weekdays: next.weekdays });
            }}
            className={`${FIELD} flex-1`}
          >
            {UNITS.map((u) => (
              <option key={u.key} value={u.key}>
                {interval === 1 ? u.one : u.many}
              </option>
            ))}
          </select>
        </div>

        {rule.frequency === "weekly" && (
          <>
            <Label>On</Label>
            <div className="flex gap-1">
              {WEEKDAY_NAMES.map((name, index) => {
                const on = rule.weekdays.includes(index);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-label={name}
                    aria-pressed={on}
                    onClick={() => toggleDay(index)}
                    className={`grid h-7 w-[30px] place-items-center rounded-(--radius-6) border text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${
                      on
                        ? "border-(--color-brand-600) bg-(--color-brand-600) text-white"
                        : "border-(--border-default) text-(--text-secondary) hover:bg-(--color-neutral-100)"
                    }`}
                  >
                    {name[0]}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {allowCompletion && (
          <>
            <Label>From</Label>
            <SegmentSwitch
              label="Repeat from"
              value={rule.from}
              options={[
                { key: "schedule", label: "Schedule" },
                { key: "completion", label: "Completion" },
              ]}
              onChange={(from) => setRule({ ...rule, from })}
            />
          </>
        )}

        <Label>Ends</Label>
        <SegmentSwitch
          label="Ends"
          value={rule.ends.kind}
          options={[
            { key: "never", label: "Never" },
            { key: "on", label: "On a date" },
            { key: "after", label: "After" },
          ]}
          onChange={(kind) =>
            setRule({
              ...rule,
              ends:
                kind === "on"
                  ? { kind, date: endDate ?? addDays(anchor, 91) }
                  : kind === "after"
                    ? { kind, count: count || 10 }
                    : { kind },
            })
          }
        />
        {rule.ends.kind === "on" && (
          <>
            <span />
            <input
              aria-label="End date"
              aria-invalid={ends === null || undefined}
              value={endText}
              onChange={(event) => setEndText(event.target.value)}
              onBlur={() => endDate && setEndText(longDate(endDate))}
              className={`${FIELD} ${ends === null ? "border-(--text-danger)" : ""}`}
            />
          </>
        )}
        {rule.ends.kind === "after" && (
          <>
            <span />
            <span className="flex items-center gap-2 text-[13px] text-(--text-secondary)">
              <input
                aria-label="Times"
                inputMode="numeric"
                value={countText}
                onChange={(event) => setCountText(event.target.value.replace(/\D/g, ""))}
                className={`${FIELD} w-14 text-center`}
              />
              {count === 1 ? "time" : "times"}
            </span>
          </>
        )}
      </div>
      <div className="-mx-1.5 flex items-center gap-2 border-t border-(--border-default) px-3 pt-2 pb-0.5">
        <span className="min-w-0 flex-1 truncate type-meta text-(--text-tertiary)">
          {result
            ? describeRepeat(result, anchor)
            : rule.ends.kind === "on"
              ? "Enter an end date on or after the start."
              : "Enter 1 to 999 times."}
        </span>
        <Button size="sm" variant="secondary" onPress={onCancel}>
          Cancel
        </Button>
        <Button size="sm" isDisabled={!result} onPress={() => result && onDone(result)}>
          Done
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-xs text-(--text-tertiary)">{children}</span>;
}
