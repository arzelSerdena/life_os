import { Button, Input, Popover } from "@heroui/react";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Minus,
  SquareCode,
  Strikethrough,
  TextQuote,
  Underline,
} from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SAVE_DELAY_MS = 600;
export const NOTES_MAX_LENGTH = 50_000;

type SaveState = "idle" | "saving" | "saved" | "error";

type NotesEditorProps = {
  /** Read once; give the editor a new `key` to load other notes. */
  initialMarkdown: string | null;
  onSave: (markdown: string | null) => Promise<unknown>;
  /** Show the Markdown source instead of the formatted notes. */
  showSource: boolean;
  /** Where the floating toolbar goes: the panel's bottom centre. */
  toolbarContainer: HTMLElement | null;
  /** Shown above the notes, such as the "Notes for" switch of a repeating event. */
  header?: ReactNode;
};

/**
 * Markdown notes, formatted while editing. Saves on its own shortly after typing stops,
 * and once more when it closes with changes not yet saved.
 */
export function NotesEditor({
  initialMarkdown,
  onSave,
  showSource,
  toolbarContainer,
  header,
}: NotesEditorProps) {
  const latest = useRef(initialMarkdown ?? "");
  const saved = useRef(initialMarkdown ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const [state, setState] = useState<SaveState>(initialMarkdown ? "saved" : "idle");
  const [source, setSource] = useState(latest.current);
  const [tooLong, setTooLong] = useState(false);

  const save = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const markdown = latest.current;
    if (markdown === saved.current) return;
    if (markdown.length > NOTES_MAX_LENGTH) {
      setTooLong(true);
      setState("error");
      return;
    }
    setTooLong(false);
    saved.current = markdown;
    saveRef.current(markdown.trim() ? markdown : null).then(
      () => latest.current === markdown && setState("saved"),
      () => {
        saved.current = "";
        setState("error");
      },
    );
  };
  const saveLater = (markdown: string) => {
    latest.current = markdown;
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  };
  // Closing the panel or switching items saves what hasn't been saved yet.
  const saveOnClose = useRef(save);
  saveOnClose.current = save;
  useEffect(() => () => saveOnClose.current(), []);

  const slash = useSlashMenu();
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Add notes…" }),
      Markdown,
    ],
    content: latest.current,
    contentType: "markdown",
    editorProps: {
      attributes: { class: "notes-content", "aria-label": "Notes" },
      handleKeyDown: (_view, event) => slash.onKeyDown(event),
    },
    onUpdate: ({ editor }) => {
      saveLater(editor.getMarkdown());
      slash.update(editor);
    },
    onSelectionUpdate: ({ editor }) => slash.update(editor),
    onBlur: () => slash.close(),
  });

  // Moving between the formatted notes and the source keeps one copy of the text.
  const wasSource = useRef(showSource);
  useEffect(() => {
    if (showSource === wasSource.current || !editor) return;
    wasSource.current = showSource;
    if (showSource) {
      setSource(latest.current);
    } else {
      editor.commands.setContent(latest.current, { contentType: "markdown", emitUpdate: false });
    }
  }, [showSource, editor]);

  const status =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? tooLong
            ? "Too long to save"
            : "Couldn't save"
          : "";

  return (
    <section
      aria-label="Notes"
      className="flex flex-col gap-1 border-t border-(--border-default) pt-3"
    >
      <div className="flex h-5 items-center justify-between">
        <h3 className="type-label text-(--text-tertiary)">Notes</h3>
        <span
          role="status"
          className={`type-meta ${state === "error" ? "text-(--text-danger)" : "text-(--text-tertiary)"}`}
        >
          {status}
        </span>
      </div>
      {header}
      {showSource ? (
        <textarea
          aria-label="Notes in Markdown"
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            saveLater(event.target.value);
          }}
          className="field-sizing-content min-h-40 resize-none rounded-(--radius-8) border border-(--border-default) bg-(--color-neutral-50) px-2.5 py-2 font-mono text-xs leading-5 text-(--text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
        />
      ) : (
        <div className="relative pb-6">
          <EditorContent editor={editor} />
          {editor && slash.menu && <SlashMenu editor={editor} slash={slash} />}
        </div>
      )}
      {editor &&
        !showSource &&
        toolbarContainer &&
        createPortal(<Toolbar editor={editor} />, toolbarContainer)}
    </section>
  );
}

// ---------- Toolbar ----------

type Tool = {
  key: string;
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const TOOL_GROUPS: Tool[][] = [
  [
    {
      key: "bold",
      label: "Bold",
      icon: Bold,
      isActive: (e) => e.isActive("bold"),
      run: (e) => e.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      label: "Italic",
      icon: Italic,
      isActive: (e) => e.isActive("italic"),
      run: (e) => e.chain().focus().toggleItalic().run(),
    },
    {
      key: "underline",
      label: "Underline",
      icon: Underline,
      isActive: (e) => e.isActive("underline"),
      run: (e) => e.chain().focus().toggleUnderline().run(),
    },
    {
      key: "strike",
      label: "Strikethrough",
      icon: Strikethrough,
      isActive: (e) => e.isActive("strike"),
      run: (e) => e.chain().focus().toggleStrike().run(),
    },
  ],
  [
    {
      key: "bullets",
      label: "Bulleted list",
      icon: List,
      isActive: (e) => e.isActive("bulletList"),
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      key: "numbers",
      label: "Numbered list",
      icon: ListOrdered,
      isActive: (e) => e.isActive("orderedList"),
      run: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "checklist",
      label: "Checklist",
      icon: ListChecks,
      isActive: (e) => e.isActive("taskList"),
      run: (e) => e.chain().focus().toggleTaskList().run(),
    },
  ],
];

const TOOL_BUTTON =
  "grid size-7 shrink-0 place-items-center rounded-[7px] text-(--text-primary) outline-none hover:bg-(--color-neutral-200) focus-visible:ring-2 focus-visible:ring-(--focus-ring) [&_svg]:size-[15px] data-[on=true]:bg-(--bg-surface) data-[on=true]:shadow-[0_1px_2px_rgb(0_0_0/0.08)]";

/** One floating pill of rounded grey groups. */
function Toolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }): Record<string, boolean> => ({
      ...Object.fromEntries(TOOL_GROUPS.flat().map((tool) => [tool.key, tool.isActive(current)])),
      link: current.isActive("link"),
      code: current.isActive("code"),
    }),
  });
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex gap-1.5 rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface) p-1 shadow-[0_2px_8px_rgb(0_0_0/0.06),0_10px_24px_rgb(0_0_0/0.08)]"
    >
      {TOOL_GROUPS.map((group) => (
        <ToolGroup key={group[0].key}>
          {group.map((tool) => (
            <button
              key={tool.key}
              type="button"
              aria-label={tool.label}
              title={tool.label}
              aria-pressed={active[tool.key]}
              data-on={active[tool.key]}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => tool.run(editor)}
              className={TOOL_BUTTON}
            >
              <tool.icon aria-hidden strokeWidth={2} />
            </button>
          ))}
        </ToolGroup>
      ))}
      <ToolGroup>
        <LinkTool editor={editor} isActive={active.link} />
        <button
          type="button"
          aria-label="Inline code"
          title="Inline code"
          aria-pressed={active.code}
          data-on={active.code}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={TOOL_BUTTON}
        >
          <Code aria-hidden strokeWidth={2} />
        </button>
      </ToolGroup>
    </div>
  );
}

function ToolGroup({ children }: { children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <span className="flex items-center rounded-[9px] bg-(--color-neutral-100) px-0.5">
      {items.flat().map((child, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the buttons never reorder
        <Fragment key={index}>
          {index > 0 && <span aria-hidden className="h-3.5 w-px shrink-0 bg-neutral-300" />}
          {child}
        </Fragment>
      ))}
    </span>
  );
}

/** Adds, changes or removes the link on the selected text. */
function LinkTool({ editor, isActive }: { editor: Editor; isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [href, setHref] = useState("");
  const open = (next: boolean) => {
    if (next) setHref(editor.getAttributes("link").href ?? "");
    setIsOpen(next);
  };
  const apply = (value: string) => {
    const chain = editor.chain().focus().extendMarkRange("link");
    if (value.trim()) chain.setLink({ href: value.trim() }).run();
    else chain.unsetLink().run();
    setIsOpen(false);
  };
  return (
    <Popover isOpen={isOpen} onOpenChange={open}>
      <Popover.Trigger
        aria-label="Link"
        className={TOOL_BUTTON}
        data-on={isActive}
        onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
      >
        <Link aria-hidden strokeWidth={2} />
      </Popover.Trigger>
      <Popover.Content placement="top" className="w-72">
        <Popover.Dialog aria-label="Link" className="p-2">
          <form
            className="flex gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              apply(href);
            }}
          >
            <Input
              aria-label="Link address"
              placeholder="https://"
              value={href}
              onChange={(event) => setHref(event.target.value)}
              autoFocus
              className="h-8 flex-1 text-[13px]"
            />
            <Button type="submit" size="sm" className="bg-brand-700 text-white">
              {href.trim() || !isActive ? "Apply" : "Remove"}
            </Button>
          </form>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

// ---------- "/" menu ----------

type BlockOption = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  apply: (editor: Editor) => void;
};

const BLOCKS: BlockOption[] = [
  {
    key: "h1",
    label: "Heading 1",
    hint: "#",
    icon: Heading1,
    apply: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    key: "h2",
    label: "Heading 2",
    hint: "##",
    icon: Heading2,
    apply: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    key: "h3",
    label: "Heading 3",
    hint: "###",
    icon: Heading3,
    apply: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    key: "quote",
    label: "Quote",
    hint: ">",
    icon: TextQuote,
    apply: (e) => e.chain().focus().setBlockquote().run(),
  },
  {
    key: "code",
    label: "Code block",
    hint: "```",
    icon: SquareCode,
    apply: (e) => e.chain().focus().setCodeBlock().run(),
  },
  {
    key: "divider",
    label: "Divider",
    hint: "---",
    icon: Minus,
    apply: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

type SlashState = { from: number; to: number; query: string; top: number; left: number };

/** Opens when a paragraph holds only "/" (plus a filter), and turns it into a block. */
function useSlashMenu() {
  const [menu, setMenu] = useState<SlashState | null>(null);
  const [index, setIndex] = useState(0);
  const live = useRef({ menu, index, editor: null as Editor | null });
  live.current.menu = menu;
  live.current.index = index;

  const options = (query: string) =>
    BLOCKS.filter((block) => block.label.toLowerCase().includes(query.toLowerCase()));

  const choose = (editor: Editor, block: BlockOption, state: SlashState) => {
    editor.chain().focus().deleteRange({ from: state.from, to: state.to }).run();
    block.apply(editor);
    setMenu(null);
  };

  return {
    menu,
    index,
    options,
    choose,
    close: () => setMenu(null),
    update(editor: Editor) {
      live.current.editor = editor;
      const { $from, empty } = editor.state.selection;
      const parent = $from.parent;
      const text = parent.textContent;
      const match = /^\/(\w*)$/.exec(text);
      if (
        !empty ||
        parent.type.name !== "paragraph" ||
        !match ||
        $from.parentOffset !== text.length
      ) {
        setMenu(null);
        return;
      }
      const start = $from.start();
      const caret = editor.view.coordsAtPos(start);
      const box = editor.view.dom.getBoundingClientRect();
      setMenu((previous) => {
        if (previous?.query !== match[1]) setIndex(0);
        return {
          from: start,
          to: start + text.length,
          query: match[1],
          top: caret.bottom - box.top + 4,
          left: caret.left - box.left,
        };
      });
    },
    onKeyDown(event: KeyboardEvent): boolean {
      const { menu: current, index: selected, editor } = live.current;
      if (!current || !editor) return false;
      const found = options(current.query);
      if (event.key === "Escape") {
        setMenu(null);
        event.stopPropagation();
        return true;
      }
      if (found.length === 0) return false;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const step = event.key === "ArrowDown" ? 1 : -1;
        setIndex((selected + step + found.length) % found.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        choose(editor, found[Math.min(selected, found.length - 1)], current);
        return true;
      }
      return false;
    },
  };
}

function SlashMenu({ editor, slash }: { editor: Editor; slash: ReturnType<typeof useSlashMenu> }) {
  const state = slash.menu;
  if (!state) return null;
  const found = slash.options(state.query);
  if (found.length === 0) return null;
  return (
    <div
      role="listbox"
      aria-label="Block types"
      className="absolute z-10 w-60 rounded-[10px] border border-(--border-default) bg-(--bg-surface) p-1.5 shadow-(--effect-overlay)"
      style={{ top: state.top, left: state.left }}
    >
      {found.map((block, i) => (
        <div
          key={block.key}
          role="option"
          tabIndex={-1}
          aria-selected={i === slash.index}
          onMouseDown={(event) => {
            event.preventDefault();
            slash.choose(editor, block, state);
          }}
          className="flex h-[30px] cursor-pointer items-center gap-2 rounded-(--radius-6) px-2 text-[13px] text-(--text-primary) hover:bg-(--color-neutral-100) aria-selected:bg-(--color-neutral-100)"
        >
          <block.icon aria-hidden className="size-[15px] text-(--text-tertiary)" strokeWidth={2} />
          <span>{block.label}</span>
          <span className="ml-auto font-mono type-meta text-(--text-tertiary)">{block.hint}</span>
        </div>
      ))}
    </div>
  );
}
