import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  /** The card's one corner icon, such as its sort and filter menu. */
  action?: ReactNode;
  /** Extra classes for the card, such as h-full to match a neighbour's height. */
  className?: string;
  children: ReactNode;
};

/** A page section card: white, 1 px border, 12 px radius, 16 px title with one line under it. */
export function SectionCard({
  title,
  description,
  action,
  className = "",
  children,
}: SectionCardProps) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface) ${className}`}
    >
      <header
        className={`flex min-h-12 items-start gap-2 pt-3 pb-1 pl-4 ${action ? "pr-2" : "pr-4"}`}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="type-column-title text-(--text-primary)">{title}</h2>
          {description && <p className="type-meta text-(--text-tertiary)">{description}</p>}
        </div>
        {action}
      </header>
      <div className="min-h-0 flex-1 px-4 pt-1 pb-4">{children}</div>
    </section>
  );
}

/** A card's body when it has nothing to show yet: one muted line saying what will appear. */
export function CardEmpty({ children }: { children: ReactNode }) {
  return <p className="flex min-h-10 items-center type-meta text-(--text-tertiary)">{children}</p>;
}
