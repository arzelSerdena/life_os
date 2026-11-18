/** Keys drawn as small key caps, as the undo toast draws Ctrl Z. */
export function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) => (
        <kbd
          key={key}
          className="grid h-5 min-w-5 place-items-center rounded-[4px] border border-(--border-default) bg-(--bg-surface) px-1 font-sans text-[11px] font-medium text-(--text-tertiary)"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
