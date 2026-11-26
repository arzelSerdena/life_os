import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { getDaysOptions } from "../../client/@tanstack/react-query.gen";
import { IconButton } from "../../components/IconButton";
import { SectionCard } from "../../components/SectionCard";
import { useCalendarStore } from "../../stores/calendarStore";
import { addMonths, monthGrid, monthTitle } from "../pickers/dates";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Small monthly calendar card on Home with dots on days that have events or tasks. */
export function MiniCalendarCard({ today }: { today: string }) {
  const navigate = useNavigate();
  const setAnchor = useCalendarStore((state) => state.setAnchor);
  const [month, setMonth] = useState(() => today.slice(0, 7));

  const days = monthGrid(month).flat();
  const firstDay = days[0] ?? `${month}-01`;

  const daysQuery = useQuery(
    getDaysOptions({
      query: {
        start: firstDay,
        count: days.length,
        include_cancelled: false,
        include_routines: false,
      },
    }),
  );

  const dotDays = new Set<string>();
  if (Array.isArray(daysQuery.data?.days)) {
    for (const d of daysQuery.data.days) {
      if (d.events.length > 0 || d.tasks.length > 0) {
        dotDays.add(d.day);
      }
    }
  }

  const openDay = (day: string) => {
    setAnchor(day);
    navigate("/calendar");
  };

  return (
    <SectionCard
      title={monthTitle(month)}
      action={
        <div className="flex items-center gap-0.5">
          <IconButton label="Previous month" onPress={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft />
          </IconButton>
          <IconButton label="Next month" onPress={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight />
          </IconButton>
          <IconButton label="Open Calendar" onPress={() => navigate("/calendar")}>
            <CalendarDays />
          </IconButton>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((letter, idx) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday header
            key={idx}
            className="pb-1 type-tag font-medium text-(--text-tertiary)"
          >
            {letter}
          </span>
        ))}
        {days.map((day) => {
          const isToday = day === today;
          const inMonth = day.slice(0, 7) === month;
          const number = Number(day.slice(8, 10));
          const hasDot = dotDays.has(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => openDay(day)}
              className={`relative mx-auto flex size-7 cursor-pointer flex-col items-center justify-center rounded-(--radius-6) text-xs tabular-nums outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring) ${
                isToday
                  ? "bg-brand-600 font-semibold text-white hover:bg-brand-700"
                  : inMonth
                    ? "text-(--text-primary)"
                    : "text-(--text-disabled)"
              }`}
            >
              <span>{number}</span>
              {hasDot && (
                <span
                  aria-hidden
                  className={`absolute bottom-0.5 size-1 rounded-full ${
                    isToday ? "bg-white" : "bg-brand-500"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
