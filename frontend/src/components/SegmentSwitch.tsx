import { ToggleButton, ToggleButtonGroup } from "@heroui/react";

/** The grey segmented switch of the approved mock-ups: Priority | Area, Areas | Calendar. */
export function SegmentSwitch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
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
          className="h-6 min-w-0 rounded-(--switch-item-radius) bg-transparent px-3 text-xs font-medium text-(--switch-default-text) hover:bg-white/60 data-[selected=true]:bg-(--switch-active-bg) data-[selected=true]:text-(--text-primary) data-[selected=true]:shadow-(--effect-raised)"
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
