import { Button, Dropdown, Label, Popover } from "@heroui/react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Property chips and the popover every picker opens from (STYLE_GUIDE.md, "Approved: Pickers"):
 * the detail panel and New task share them.
 */

export type ChipTone = "default" | "danger" | "ghost";

const CHIP_TONES: Record<ChipTone, string> = {
  default:
    "border-(--border-default) bg-(--bg-surface) text-(--text-secondary) [&_svg]:text-(--text-tertiary)",
  danger:
    "border-(--color-negative-200) bg-(--color-negative-50) text-(--color-negative-700) [&_svg]:text-(--color-negative-700)",
  ghost: "border-dashed border-(--border-default) bg-(--bg-surface) text-(--text-tertiary)",
};

/** While its picker is open, the chip gets the focus ring: accent-600 border, accent-200 halo. */
const OPEN_RING =
  "data-[open=true]:border-solid data-[open=true]:border-(--color-brand-600) data-[open=true]:text-(--text-primary) data-[open=true]:shadow-[0_0_0_2px_var(--color-brand-200)]";

export function chipClass(tone: ChipTone = "default", interactive = true): string {
  return `inline-flex h-6 min-w-0 items-center gap-[5px] rounded-(--radius-6) border px-2 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) [&_svg]:size-[13px] [&_svg]:shrink-0 ${CHIP_TONES[tone]} ${
    interactive
      ? `cursor-pointer hover:bg-(--color-neutral-50) hover:text-(--text-primary) data-[tone=danger]:hover:bg-(--color-negative-100) ${OPEN_RING}`
      : ""
  }`;
}

/** A property shown as a small outlined chip. Without `onPress` it only shows the value. */
export function Chip({
  icon: Icon,
  tone = "default",
  label,
  onPress,
  children,
}: {
  icon?: LucideIcon;
  tone?: ChipTone;
  label?: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  const body = (
    <>
      {Icon && <Icon aria-hidden strokeWidth={2} />}
      {children}
    </>
  );
  return onPress ? (
    <button
      type="button"
      aria-label={label}
      data-tone={tone}
      onClick={onPress}
      className={chipClass(tone)}
    >
      {body}
    </button>
  ) : (
    <span data-tone={tone} className={chipClass(tone, false)}>
      {body}
    </span>
  );
}

/** A chip that opens a menu of choices, such as a task's priority. */
export function MenuChip<T extends string>({
  icon: Icon,
  leading,
  tone = "default",
  label,
  value,
  options,
  onChange,
  children,
}: {
  icon?: LucideIcon;
  /** Drawn in place of the icon, such as an area-coloured folder. */
  leading?: ReactNode;
  tone?: ChipTone;
  label: string;
  value: T;
  options: { id: T; label: string; leading?: ReactNode; note?: string }[];
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <Dropdown>
      <Button aria-label={label} data-tone={tone} className={`${chipClass(tone)} min-w-0`}>
        {leading ?? (Icon && <Icon aria-hidden strokeWidth={2} />)}
        {children}
      </Button>
      <Dropdown.Popover placement="bottom start" className="min-w-[200px]">
        <Dropdown.Menu
          aria-label={label}
          selectionMode="single"
          selectedKeys={[value]}
          onAction={(key) => key !== value && onChange(key as T)}
        >
          {options.map((option) => (
            <Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
              {option.leading}
              <Label>{option.label}</Label>
              {option.note && (
                <span className="ml-auto pl-3 type-meta text-(--text-tertiary)">{option.note}</span>
              )}
              {/* The current choice gets the accent check. */}
              <Dropdown.ItemIndicator
                className={`${option.note ? "" : "ml-auto"} text-(--color-brand-600)`}
              />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** A chip that opens a popover: the frame for the date, owner and repeat pickers. */
export function PopoverChip({
  icon: Icon,
  leading,
  tone = "default",
  label,
  isOpen,
  onOpenChange,
  width = 252,
  chip,
  children,
}: {
  icon?: LucideIcon;
  leading?: ReactNode;
  tone?: ChipTone;
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The popover's width in px. */
  width?: number;
  /** What the chip says. */
  chip: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger
        aria-label={label}
        data-tone={tone}
        data-open={isOpen}
        className={chipClass(tone)}
      >
        {leading ?? (Icon && <Icon aria-hidden strokeWidth={2} />)}
        {chip}
      </Popover.Trigger>
      <Popover.Content
        placement="bottom start"
        style={{ width }}
        className="rounded-[10px] border border-(--border-default) p-0"
      >
        <Popover.Dialog aria-label={label} className="flex flex-col p-1.5 outline-none">
          {children}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/**
 * A form field that opens a picker, such as New event's Owner, dates and times: a 32 px
 * input with the value and a chevron, which gets the focus ring while its picker is open.
 */
export function PopoverField({
  icon: Icon,
  leading,
  label,
  isOpen,
  onOpenChange,
  width = 252,
  placement = "bottom start",
  isPlaceholder = false,
  value,
  children,
}: {
  icon?: LucideIcon;
  leading?: ReactNode;
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  width?: number;
  /** Lists open aligned to the field's right edge (the event time list). */
  placement?: "bottom start" | "bottom end";
  /** The value is a prompt ("Pick an area or project"), shown in the placeholder colour. */
  isPlaceholder?: boolean;
  value: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger
        aria-label={label}
        data-open={isOpen}
        className={`flex h-8 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 text-left text-[13px] whitespace-nowrap outline-none hover:border-(--color-neutral-300) focus-visible:ring-2 focus-visible:ring-(--focus-ring) data-[open=true]:border-(--color-brand-600) data-[open=true]:shadow-[0_0_0_2px_var(--color-brand-200)] [&_svg]:shrink-0 ${
          isPlaceholder ? "text-(--text-tertiary)" : "text-(--text-primary)"
        }`}
      >
        {leading ?? (Icon && <Icon aria-hidden className="size-3.5 text-(--text-tertiary)" />)}
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <ChevronDown aria-hidden className="size-3 text-(--text-tertiary)" />
      </Popover.Trigger>
      <Popover.Content
        placement={placement}
        style={{ width }}
        className="rounded-[10px] border border-(--border-default) p-0"
      >
        <Popover.Dialog aria-label={label} className="flex flex-col p-1.5 outline-none">
          {children}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/**
 * A breadcrumb item that opens a picker, such as the detail panel's owner and section
 * (Approved: Pickers): quiet text that gets a grey fill and the focus ring while open.
 */
export function CrumbPicker({
  label,
  isOpen,
  onOpenChange,
  width = 252,
  crumb,
  children,
}: {
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  width?: number;
  crumb: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover isOpen={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger
        aria-label={label}
        data-open={isOpen}
        className="-mx-1 min-w-0 cursor-pointer truncate rounded-(--radius-6) px-1 outline-none hover:bg-(--color-neutral-100) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus-ring) data-[open=true]:bg-(--color-neutral-100) data-[open=true]:text-(--text-primary) data-[open=true]:shadow-[0_0_0_2px_var(--color-brand-200)]"
      >
        {crumb}
      </Popover.Trigger>
      <Popover.Content
        placement="bottom start"
        style={{ width }}
        className="rounded-[10px] border border-(--border-default) p-0"
      >
        <Popover.Dialog aria-label={label} className="flex flex-col p-1.5 outline-none">
          {children}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** A picker row: 30 px, 13 px text, a value at the right in 12 px tertiary, a check if chosen. */
export function PickerRow({
  leading,
  note,
  selected = false,
  indent = false,
  onPress,
  children,
}: {
  leading?: ReactNode;
  note?: ReactNode;
  selected?: boolean;
  indent?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPress}
      className={`flex h-[30px] w-full shrink-0 items-center gap-2 rounded-(--radius-6) pr-2 text-left text-[13px] whitespace-nowrap text-(--text-primary) outline-none hover:bg-(--color-neutral-100) focus-visible:bg-(--color-neutral-100) [&_svg]:shrink-0 ${
        indent ? "pl-7" : "pl-2"
      } ${selected ? "font-medium" : ""}`}
    >
      {leading}
      <span className="min-w-0 truncate">{children}</span>
      {note !== undefined && (
        <span className="ml-auto pl-3 text-xs font-normal text-(--text-tertiary)">{note}</span>
      )}
      {selected && (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={`${note === undefined ? "ml-auto" : "ml-2"} size-[15px] fill-none stroke-(--color-brand-600) stroke-2`}
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}

export function PickerSeparator() {
  return <hr className="-mx-1.5 my-1.5 h-px shrink-0 bg-(--border-default) border-0" />;
}
