import { ToggleButton, ToggleButtonGroup } from "@heroui/react";

/** The grey segmented switch of the approved mock-ups: Priority | Area, Areas | Calendar,
 * Areas | Projects | Routines with their counters. */
export function SegmentSwitch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  /** A count shows as a grey counter after the label, and not at all when it is 0. */
  options: { key: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const [selected] = keys;
        onChange(selected as T);
      }}
      className="h-7 shrink-0 gap-0 rounded-(--switch-container-radius) bg-(--switch-container-bg) p-0.5"
    >
      {options.map((option) => (
        <ToggleButton
          key={option.key}
          id={option.key}
          className="h-6 min-w-0 rounded-(--switch-item-radius) bg-transparent px-3 text-xs font-medium text-(--switch-default-text) hover:bg-(--bg-surface)/60 data-[selected=true]:bg-(--switch-active-bg) data-[selected=true]:text-(--text-primary) data-[selected=true]:shadow-(--effect-raised)"
        >
          {option.label}
          {option.count ? (
            <span className="ml-1.5 type-counter text-(--text-tertiary) tabular-nums">
              {option.count}
            </span>
          ) : null}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
