import { Button, Popover } from "@heroui/react";
import { Clock3 } from "lucide-react";
import { useState } from "react";
import { formatTime, useTimeFormat } from "../tasks/format";
import { chipClass } from "./chips";

/**
 * Optional start/end time chip shared by tasks (scheduled_time / scheduled_end_time)
 * and routines (start_time / end_time).
 */
export function TimeRangeChip({
  startTime,
  endTime,
  label = "Time",
  emptyLabel = "Time",
  requireEndAfterStart = false,
  onChange,
}: {
  startTime: string | null;
  endTime: string | null;
  label?: string;
  emptyLabel?: string;
  /** When true, end time must be on or after start time (e.g. tasks). */
  requireEndAfterStart?: boolean;
  onChange: (next: { startTime: string | null; endTime: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const timeFormat = useTimeFormat();
  const startValue = startTime ? startTime.slice(0, 5) : "";
  const endValue = endTime ? endTime.slice(0, 5) : "";
  const text = startTime
    ? endTime
      ? `${formatTime(startTime, timeFormat)} – ${formatTime(endTime, timeFormat)}`
      : formatTime(startTime, timeFormat)
    : emptyLabel;

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <button
          type="button"
          aria-label={label}
          className={chipClass(startTime ? "default" : "ghost")}
        >
          <Clock3 aria-hidden strokeWidth={2} />
          {text}
        </button>
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="w-[240px] p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="type-label text-(--text-tertiary)">Start</span>
              <input
                type="time"
                aria-label="Start time"
                value={startValue}
                onChange={(event) => {
                  const nextStart = event.target.value ? `${event.target.value}:00` : null;
                  const nextEnd =
                    !nextStart || (requireEndAfterStart && endTime !== null && endTime < nextStart)
                      ? null
                      : endTime;
                  onChange({ startTime: nextStart, endTime: nextEnd });
                }}
                className="h-8 w-full rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2 type-body text-(--text-primary) outline-none focus:border-(--color-brand-600)"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="type-label text-(--text-tertiary)">End</span>
              <input
                type="time"
                aria-label="End time"
                disabled={!startValue}
                min={requireEndAfterStart ? startValue : undefined}
                value={endValue}
                onChange={(event) => {
                  const nextEnd = event.target.value ? `${event.target.value}:00` : null;
                  if (
                    requireEndAfterStart &&
                    nextEnd !== null &&
                    startTime !== null &&
                    nextEnd < startTime
                  ) {
                    return;
                  }
                  onChange({ startTime, endTime: nextEnd });
                }}
                className="h-8 w-full rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2 type-body text-(--text-primary) outline-none focus:border-(--color-brand-600) disabled:opacity-50"
              />
            </label>
          </div>
          {startTime && (
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              onPress={() => {
                onChange({ startTime: null, endTime: null });
                setOpen(false);
              }}
            >
              Clear time
            </Button>
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
}
