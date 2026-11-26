import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { IconButton } from "../../components/IconButton";
import { SectionCard } from "../../components/SectionCard";
import { useHomeStore } from "../../stores/homeStore";
import { NotesEditor } from "../detail-panel/NotesEditor";

/** Quick Markdown scratchpad card on Home to capture anything immediately. */
export function DumpNoteCard() {
  const dumpNote = useHomeStore((state) => state.dumpNote);
  const setDumpNote = useHomeStore((state) => state.setDumpNote);
  const clearCountRef = useRef(0);
  const [clearCount, setClearCount] = useState(0);

  return (
    <SectionCard
      title="Quick Note"
      description="Capture anything"
      action={
        dumpNote.trim() ? (
          <IconButton
            label="Clear note"
            onPress={() => {
              clearCountRef.current += 1;
              setDumpNote("");
              setClearCount(clearCountRef.current);
            }}
          >
            <Trash2 />
          </IconButton>
        ) : undefined
      }
    >
      <div className="min-h-[110px] bg-transparent">
        <NotesEditor
          key={clearCount}
          initialMarkdown={dumpNote || null}
          variant="plain"
          showSource={false}
          toolbarContainer={null}
          onSave={async (markdown) => {
            if (clearCountRef.current !== clearCount) return;
            setDumpNote(markdown ?? "");
          }}
        />
      </div>
    </SectionCard>
  );
}
