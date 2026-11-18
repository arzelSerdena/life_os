import type { Tile } from "./routine";
import { Sparkline } from "./Sparkline";

/** Calculated tiles in the execution-stats style, one row: the routine page's and the
 * Routines overview's five, the Projects overview's six. */
export function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile) => (
        <article
          key={tile.label}
          aria-label={tile.label}
          className="flex min-w-0 flex-col gap-1 rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface) px-4 py-3"
        >
          <h3 className="truncate text-xs leading-4 font-medium text-(--text-tertiary)">
            {tile.label}
          </h3>
          <div className="flex h-8 items-end gap-0.5">
            <span
              className={`text-2xl leading-8 font-semibold tabular-nums ${tile.value === "—" ? "text-(--text-disabled)" : "text-(--text-primary)"}`}
            >
              {tile.value}
            </span>
            {tile.unit && (
              <span className="text-[13px] leading-6 font-medium text-(--text-tertiary)">
                {tile.unit}
              </span>
            )}
            <Sparkline points={tile.points} tips={tile.tips} good={tile.good} />
          </div>
          <p className="min-h-4 truncate type-meta text-(--text-tertiary)">{tile.line}</p>
        </article>
      ))}
    </div>
  );
}
