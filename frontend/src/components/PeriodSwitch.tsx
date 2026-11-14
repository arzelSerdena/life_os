import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PERIODS, type Period, periodLabel } from "../period";
import { usePeriodStore } from "../stores/periodStore";
import { IconButton } from "./IconButton";

const PERIOD_NAMES: Record<Period, string> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

/** Week / Month / Quarter / Year, with ‹ › to step through periods and the period's name. */
export function PeriodSwitch() {
  const { period, date, setPeriod, shift } = usePeriodStore();
  return (
    <div className="flex items-center gap-2">
      <ToggleButtonGroup
        aria-label="Period"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[period]}
        onSelectionChange={(keys) => {
          const [selected] = keys;
          setPeriod(selected as Period);
        }}
        className="h-7 gap-0 rounded-(--switch-container-radius) bg-(--switch-container-bg) p-0.5"
      >
        {PERIODS.map((key) => (
          <ToggleButton
            key={key}
            id={key}
            className="h-6 min-w-0 rounded-(--switch-item-radius) bg-transparent px-3 text-xs font-medium text-(--switch-default-text) hover:bg-white/60 data-[selected=true]:bg-(--switch-active-bg) data-[selected=true]:text-(--text-primary) data-[selected=true]:shadow-(--effect-raised)"
          >
            {PERIOD_NAMES[key]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div className="flex items-center gap-0.5">
        <IconButton label="Previous period" size="md" onPress={() => shift(-1)}>
          <ChevronLeft />
        </IconButton>
        <span className="min-w-16 text-center text-[13px] font-semibold" aria-live="polite">
          {periodLabel(period, date)}
        </span>
        <IconButton label="Next period" size="md" onPress={() => shift(1)}>
          <ChevronRight />
        </IconButton>
      </div>
    </div>
  );
}
