/** A neutral counter pill used on column headers, group headings, and panels. */
export function Counter({ count }: { count: number | string }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-(--counter-bg) px-1.5 type-tag font-medium tracking-normal text-(--text-secondary) normal-case tabular-nums">
      {count}
    </span>
  );
}
