import { Button } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { ChartLine, Check } from "lucide-react";
import { useState } from "react";
import { createMetricEntryMutation } from "../../client/@tanstack/react-query.gen";
import type { LogMetricRead } from "../../client/types.gen";
import { SectionCard } from "../../components/SectionCard";
import { useChangeToast } from "../../stores/changeToastStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { areaDataAttribute } from "../life-areas/palette";
import { formatValue, inputAffixes, parseValue } from "../metrics/format";
import { logLine } from "./home";

/** Manual metrics with a per-day or per-week target and no entry today: type a value and
 * Enter (or the check) logs it, with the undo toast. Hidden when nothing needs a log. */
export function LogTodayCard({
  metrics,
  colorOf,
}: {
  metrics: LogMetricRead[];
  colorOf: (lifeAreaId: number | null) => string | null;
}) {
  if (metrics.length === 0) return null;
  return (
    <SectionCard title="Log today" description={`${metrics.length} to log`}>
      <ul className="flex flex-col">
        {metrics.map((metric) => (
          <LogRow key={metric.metric_id} metric={metric} color={colorOf(metric.life_area_id)} />
        ))}
      </ul>
    </SectionCard>
  );
}

function LogRow({ metric, color }: { metric: LogMetricRead; color: string | null }) {
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);
  const showToast = useChangeToast((state) => state.show);
  const log = useMutation(createMetricEntryMutation());
  const { prefix, suffix } = inputAffixes(metric);
  const submit = () => {
    const value = parseValue(text, metric.format);
    if (value === null) {
      setInvalid(true);
      return;
    }
    log.mutate(
      { path: { metric_id: metric.metric_id }, body: { value } },
      {
        onSuccess: (change) => {
          setText("");
          showToast(`Logged ${formatValue(value, metric)} · ${metric.title}`, change.batch_id);
        },
      },
    );
  };

  return (
    <li
      data-area={areaDataAttribute(color)}
      className="flex min-h-12 items-center gap-2.5 py-1.5 not-first:border-t not-first:border-(--color-neutral-100)"
    >
      <ChartLine aria-hidden className="size-4 shrink-0 text-(--area-solid)" strokeWidth={2} />
      <span className="relative flex min-w-0 flex-1 flex-col">
        <PanelLink
          stretched
          target={{ kind: "metric", id: metric.metric_id }}
          className="truncate text-sm font-medium text-(--text-primary)"
        >
          {metric.title}
        </PanelLink>
        <span className="truncate type-meta text-(--text-tertiary)">
          {invalid ? (
            <span role="alert" className="text-(--text-danger)">
              Enter a number.
            </span>
          ) : log.isError ? (
            <span role="alert" className="text-(--text-danger)">
              Couldn't save. Try again.
            </span>
          ) : (
            logLine(metric)
          )}
        </span>
      </span>
      <label className="flex h-[30px] w-[132px] shrink-0 cursor-text items-center gap-1 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-200">
        {prefix && <span className="text-xs text-(--text-tertiary)">{prefix}</span>}
        <input
          inputMode="decimal"
          aria-label={`${metric.title} today`}
          placeholder="0"
          value={text}
          disabled={log.isPending}
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          className="min-w-0 flex-1 bg-transparent text-right type-body font-medium text-(--text-primary) tabular-nums outline-none placeholder:text-(--text-disabled)"
        />
        {suffix && <span className="text-xs text-(--text-tertiary)">{suffix}</span>}
      </label>
      <Button
        isIconOnly
        variant="secondary"
        size="sm"
        aria-label={`Log ${metric.title}`}
        isDisabled={log.isPending || text.trim() === ""}
        onPress={submit}
        className="size-[30px] min-w-0 shrink-0"
      >
        <Check aria-hidden className="size-[15px]" />
      </Button>
    </li>
  );
}
