import { Modal } from "@heroui/react";
import { X } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { useCommands } from "../../stores/commandStore";
import { Keys } from "./Keys";

type Shortcut = { keys: string[][]; label: string };

/** Every shortcut, by where it works. Alternatives are separate key groups ("Ctrl N" or "N"). */
export const SHORTCUT_GROUPS: { title: string; shortcuts: Shortcut[] }[] = [
  {
    title: "Everywhere",
    shortcuts: [
      { keys: [["Ctrl", "K"]], label: "Search and run commands" },
      { keys: [["Ctrl", "N"], ["N"]], label: "New task" },
      { keys: [["Ctrl", "B"]], label: "Show or hide the sidebar" },
      { keys: [["Ctrl", "Z"]], label: "Undo" },
      { keys: [["Esc"]], label: "Close the pop-up or detail panel" },
      { keys: [["?"]], label: "Keyboard shortcuts" },
    ],
  },
  {
    title: "Calendar",
    shortcuts: [
      { keys: [["1"], ["2"], ["3"], ["4"]], label: "Week, Month, Quarter, Year" },
      { keys: [["T"]], label: "Go to today" },
      { keys: [["←"], ["→"]], label: "Previous or next period" },
    ],
  },
  {
    title: "Inbox card",
    shortcuts: [
      { keys: [["A"]], label: "Pick an area" },
      { keys: [["T"]], label: "Schedule today" },
      { keys: [["D"]], label: "Pick a date" },
    ],
  },
];

/** The `?` pop-up while it is open; mounted by AppLayout. */
export function ShortcutsHost() {
  const isOpen = useCommands((state) => state.open === "shortcuts");
  return isOpen ? <ShortcutsDialog /> : null;
}

/** `?` lists the keyboard shortcuts. A pop-up in the New task style, read only. */
function ShortcutsDialog() {
  const close = useCommands((state) => state.close);
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(isOpen) => !isOpen && close()}
      className="bg-[rgb(17_24_39/0.32)]"
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className="w-[480px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
          <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
            <Modal.Heading className="type-panel-title text-(--text-primary)">
              Keyboard shortcuts
            </Modal.Heading>
            <IconButton label="Close" size="md" onPress={close}>
              <X />
            </IconButton>
          </Modal.Header>
          <Modal.Body className="m-0 flex flex-col gap-4 px-5 pt-3 pb-5">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} aria-label={group.title} className="flex flex-col">
                <h3 className="flex h-6 items-center type-label text-(--text-tertiary)">
                  {group.title}
                </h3>
                <dl className="flex flex-col">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.label}
                      className="flex h-8 items-center justify-between gap-4 border-b border-(--border-default) last:border-b-0"
                    >
                      <dt className="type-body text-(--text-primary)">{shortcut.label}</dt>
                      <dd className="flex items-center gap-1.5">
                        {shortcut.keys.map((keys, index) => (
                          <span key={keys.join("+")} className="flex items-center gap-1.5">
                            {index > 0 && shortcut.keys.length === 2 && (
                              <span className="type-meta text-(--text-tertiary)">or</span>
                            )}
                            <Keys keys={keys} />
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
