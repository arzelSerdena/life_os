import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { Check, Code, Ellipsis, type LucideIcon } from "lucide-react";
import {
  createContext,
  Fragment,
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
  /** Red, after a separator: Delete. */
  isDanger?: boolean;
  /** Says why the action is disabled. */
  hint?: string;
};

export type PanelNotes = {
  /** Changing the key loads other notes, such as one occurrence's instead of the series'. */
  key: string;
  markdown: string | null;
  save: (markdown: string | null) => Promise<unknown>;
  header?: ReactNode;
};

type PanelViewProps = {
  /** Text, or a picker such as the owner's; the last one is darker. */
  crumbs: ReactNode[];
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
              // biome-ignore lint/suspicious/noArrayIndexKey: a crumb's place is its identity
              key={index}
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

/** The ⋯ menu: the panel's, the routine page header's and each step row's. */
export function PanelMenu({
  actions,
  label = "More actions",
  placement = "bottom end",
  onOpenChange,
}: {
  actions: PanelAction[];
  label?: string;
  placement?: "bottom end" | "bottom start";
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const firstDanger = actions.find((action) => action.isDanger)?.id;
  return (
    <Dropdown onOpenChange={onOpenChange}>
      <Button
        isIconOnly
        variant="ghost"
        aria-label={label}
        className="size-7 min-w-0 rounded-(--radius-6) text-(--text-tertiary) hover:bg-(--bg-hover) hover:text-(--text-primary) [&_svg]:size-4"
      >
        <Ellipsis aria-hidden />
      </Button>
      <Dropdown.Popover placement={placement} className="min-w-[200px] max-w-[250px]">
        <Dropdown.Menu
          aria-label={label}
          disabledKeys={actions.filter((a) => a.isDisabled).map((a) => a.id)}
          onAction={(key) => actions.find((action) => action.id === key)?.onAction()}
        >
          {actions.map((action) => (
            <Fragment key={action.id}>
              {action.id === firstDanger && <Separator />}
              <Dropdown.Item
                id={action.id}
                textValue={action.label}
                variant={action.isDanger ? "danger" : undefined}
                className={action.hint ? "items-start" : undefined}
              >
                <action.icon
                  aria-hidden
                  className={`size-4 shrink-0 ${action.hint ? "mt-1" : ""} ${
                    action.isDanger ? "" : "text-(--text-tertiary)"
                  }`}
                />
                {action.hint ? (
                  <span className="flex flex-col py-1">
                    <Label>{action.label}</Label>
                    <span className="text-[11px] leading-[14px] text-(--text-tertiary)">
                      {action.hint}
                    </span>
                  </span>
                ) : (
                  <Label>{action.label}</Label>
                )}
              </Dropdown.Item>
            </Fragment>
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
      className={`${MARKER} hit-24 relative cursor-pointer bg-(--area-tint-active) text-white outline-none hover:bg-(--area-border) focus-visible:ring-2 focus-visible:ring-(--focus-ring)`}
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

// The chips and pickers are shared with New task.
export { Chip, type ChipTone, chipClass, MenuChip } from "../pickers/chips";
export { DateChip } from "../pickers/DatePicker";
