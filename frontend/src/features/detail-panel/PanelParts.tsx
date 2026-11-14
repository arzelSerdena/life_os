import { Button, Dropdown, Label, Popover } from "@heroui/react";
import { Check, Code, Ellipsis, type LucideIcon } from "lucide-react";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { QueryError } from "../../components/QueryError";
import { NotesEditor } from "./NotesEditor";

/** The panel frame's bottom-centre slot, where the notes toolbar floats. */
export const ToolbarSlot = createContext<HTMLElement | null>(null);

export type PanelAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onAction: () => void;
  isDisabled?: boolean;
};

export type PanelNotes = {
  /** Changing the key loads other notes, such as one occurrence's instead of the series'. */
  key: string;
  markdown: string | null;
  save: (markdown: string | null) => Promise<unknown>;
  header?: ReactNode;
};

type PanelViewProps = {
  crumbs: string[];
  marker: ReactNode;
  title: string;
  /** Saves a new title; omit when the title can't be changed here. */
  onRename?: (title: string) => Promise<unknown>;
  /** Shown between the title and the chips, such as an area's vision. */
  lead?: ReactNode;
  chips: ReactNode;
  /** Shown between the chips and the notes, such as a task's subtasks. */
  content?: ReactNode;
  notes: PanelNotes;
  actions?: PanelAction[];
  error?: unknown;
};

/** Header, title row, chips, content and notes: the same layout for every entity. */
export function PanelView({
  crumbs,
  marker,
  title,
  onRename,
  lead,
  chips,
  content,
  notes,
  actions = [],
  error,
}: PanelViewProps) {
  const toolbar = useContext(ToolbarSlot);
  const [showSource, setShowSource] = useState(false);
  const menu: PanelAction[] = [
    {
      id: "markdown",
      label: showSource ? "View formatted" : "View Markdown",
      icon: Code,
      onAction: () => setShowSource((value) => !value),
    },
    ...actions,
  ];
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 pt-3 pr-4 pl-6">
        <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-(--area-solid)" />
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap text-(--text-tertiary)"
        >
          {crumbs.map((crumb, index) => (
            <span
              key={crumbs.slice(0, index + 1).join("/")}
              className="flex min-w-0 items-center gap-1.5"
            >
              {index > 0 && <span className="text-neutral-300">/</span>}
              <span
                className={`truncate ${index === crumbs.length - 1 ? "text-(--text-secondary)" : ""}`}
              >
                {crumb}
              </span>
            </span>
          ))}
        </nav>
        <span className="flex-1" />
        <PanelMenu actions={menu} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 pt-3 pb-28">
        <div className="flex items-start gap-2.5">
          {marker}
          <EditableTitle value={title} onSave={onRename} />
        </div>
        {lead}
        <div className="flex flex-wrap gap-1.5">{chips}</div>
        {error ? <QueryError error={error} /> : null}
        {content}
        <NotesEditor
          key={notes.key}
          initialMarkdown={notes.markdown}
          onSave={notes.save}
          header={notes.header}
          showSource={showSource}
          toolbarContainer={toolbar}
        />
      </div>
    </>
  );
}

function PanelMenu({ actions }: { actions: PanelAction[] }) {
  return (
    <Dropdown>
      <Button
        isIconOnly
        variant="ghost"
        aria-label="More actions"
        className="size-7 min-w-0 rounded-(--radius-6) text-(--text-tertiary) hover:bg-(--bg-hover) hover:text-(--text-primary) [&_svg]:size-4"
      >
        <Ellipsis aria-hidden />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[200px]">
        <Dropdown.Menu
          aria-label="More actions"
          disabledKeys={actions.filter((a) => a.isDisabled).map((a) => a.id)}
          onAction={(key) => actions.find((action) => action.id === key)?.onAction()}
        >
          {actions.map((action) => (
            <Dropdown.Item key={action.id} id={action.id} textValue={action.label}>
              <action.icon aria-hidden className="size-4 shrink-0 text-(--text-tertiary)" />
              <Label>{action.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** Text that edits in place: Enter or leaving the field saves, Esc puts it back. */
function useInlineEdit(value: string, onSave?: (value: string) => Promise<unknown>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = draft.trim();
    if (!onSave || next === value.trim()) {
      setDraft(value);
      return;
    }
    onSave(next).catch(() => setDraft(value));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, multiline = false) => {
    if (event.key === "Enter" && !(multiline && event.shiftKey)) {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      setDraft(value);
      requestAnimationFrame(() => (event.target as HTMLTextAreaElement).blur());
    }
  };
  return { draft, setDraft, commit, onKeyDown };
}

const INLINE_FIELD =
  "field-sizing-content w-full resize-none rounded-(--radius-6) bg-transparent outline-none hover:bg-(--bg-hover) focus:bg-transparent focus:shadow-[inset_0_0_0_1px_var(--color-brand-300)] read-only:hover:bg-transparent";

function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave?: (value: string) => Promise<unknown>;
}) {
  const edit = useInlineEdit(value, async (next) => {
    if (next && onSave) await onSave(next);
    else throw new Error("A title is required.");
  });
  return (
    <textarea
      aria-label="Title"
      rows={1}
      maxLength={200}
      readOnly={!onSave}
      value={edit.draft}
      onChange={(event) => edit.setDraft(event.target.value.replace(/\n/g, " "))}
      onBlur={edit.commit}
      onKeyDown={(event) => edit.onKeyDown(event)}
      className={`${INLINE_FIELD} -mx-1 min-w-0 flex-1 px-1 text-xl leading-7 font-semibold tracking-[-0.01em] text-(--text-primary)`}
    />
  );
}

/** A line of secondary text that edits in place, such as an area's vision. */
export function EditableLine({
  value,
  label,
  placeholder,
  maxLength,
  onSave,
}: {
  value: string | null;
  label: string;
  placeholder: string;
  maxLength: number;
  onSave: (value: string | null) => Promise<unknown>;
}) {
  const edit = useInlineEdit(value ?? "", (next) => onSave(next || null));
  return (
    <textarea
      aria-label={label}
      rows={1}
      maxLength={maxLength}
      placeholder={placeholder}
      value={edit.draft}
      onChange={(event) => edit.setDraft(event.target.value)}
      onBlur={edit.commit}
      onKeyDown={(event) => edit.onKeyDown(event, true)}
      className={`${INLINE_FIELD} -mx-1 -mt-1.5 px-1 text-[13px] leading-[19px] text-(--text-secondary) placeholder:text-(--text-disabled)`}
    />
  );
}

// ---------- Markers ----------

const MARKER =
  "mt-[3px] grid size-[22px] shrink-0 place-items-center rounded-(--radius-6) [&_svg]:size-3.5";

/** The 22 px tile before the title, in the area's tint. */
export function Marker({ icon: Icon, solid }: { icon?: LucideIcon; solid?: boolean }) {
  return (
    <span
      aria-hidden
      className={`${MARKER} ${solid ? "bg-(--area-solid) text-white" : "bg-(--area-tint-active) text-(--area-solid)"}`}
    >
      {Icon ? (
        <Icon strokeWidth={2} />
      ) : (
        <span className="size-2.5 rounded-[3px] bg-(--area-solid)" />
      )}
    </span>
  );
}

/** A task's marker: a checkbox outline that marks the task done (or open again). */
export function TaskMarker({
  done,
  title,
  onToggle,
}: {
  done: boolean;
  title: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={done ? `Mark ${title} not done` : `Mark ${title} done`}
      aria-pressed={done}
      title={done ? "Mark not done" : "Mark done"}
      onClick={onToggle}
      className={`${MARKER} cursor-pointer bg-(--area-tint-active) text-white outline-none hover:bg-(--area-border) focus-visible:ring-2 focus-visible:ring-(--focus-ring)`}
    >
      <span
        className={`grid size-[11px] place-items-center rounded-[3px] border-[1.75px] border-(--area-solid) ${done ? "bg-(--area-solid)" : ""}`}
      >
        {done && <Check className="size-2!" strokeWidth={4} />}
      </span>
    </button>
  );
}

// ---------- Chips ----------

export type ChipTone = "default" | "danger" | "ghost";

const CHIP_TONES: Record<ChipTone, string> = {
  default:
    "border-(--border-default) bg-(--bg-surface) text-(--text-secondary) [&_svg]:text-(--text-tertiary)",
  danger: "border-(--color-negative-200) bg-(--color-negative-50) text-(--color-negative-700)",
  ghost: "border-dashed border-(--border-default) bg-(--bg-surface) text-(--text-tertiary)",
};

export function chipClass(tone: ChipTone = "default", interactive = true): string {
  return `inline-flex h-6 items-center gap-[5px] rounded-(--radius-6) border px-2 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) [&_svg]:size-[13px] [&_svg]:shrink-0 ${CHIP_TONES[tone]} ${
    interactive
      ? "cursor-pointer hover:bg-(--color-neutral-50) hover:text-(--text-primary) data-[tone=danger]:hover:bg-(--color-negative-100)"
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
  tone = "default",
  label,
  value,
  options,
  onChange,
  children,
}: {
  icon?: LucideIcon;
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
        {Icon && <Icon aria-hidden strokeWidth={2} />}
        {children}
      </Button>
      <Dropdown.Popover placement="bottom start" className="min-w-[180px]">
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
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** A chip that picks a date, or clears it. */
export function DateChip({
  icon: Icon,
  tone = "default",
  label,
  value,
  onChange,
  children,
}: {
  icon?: LucideIcon;
  tone?: ChipTone;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const commit = (next: string | null) => {
    if (next !== value && (next === null || /^\d{4}-\d{2}-\d{2}$/.test(next))) onChange(next);
  };
  // The date saves when the picker closes: typing fires a change on every digit.
  const openChange = (next: boolean) => {
    if (next) setDraft(value ?? "");
    else commit(draft || null);
    setIsOpen(next);
  };
  const pick = (next: string | null) => {
    setDraft(next ?? "");
    commit(next);
    setIsOpen(false);
  };
  return (
    <Popover isOpen={isOpen} onOpenChange={openChange}>
      <Popover.Trigger aria-label={label} data-tone={tone} className={chipClass(tone)}>
        {Icon && <Icon aria-hidden strokeWidth={2} />}
        {children}
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="w-60">
        <Popover.Dialog aria-label={label} className="flex flex-col gap-2 p-3">
          <span className="type-label text-(--text-tertiary)">{label}</span>
          <input
            type="date"
            aria-label={label}
            value={draft}
            onKeyDown={(event) => {
              if (event.key === "Enter") pick(event.currentTarget.value || null);
            }}
            onChange={(event) => setDraft(event.target.value)}
            className="h-8 rounded-(--radius-6) border border-(--border-default) px-2 text-[13px] text-(--text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
          />
          {value && (
            <Button size="sm" variant="ghost" onPress={() => pick(null)} className="self-start">
              Clear
            </Button>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
