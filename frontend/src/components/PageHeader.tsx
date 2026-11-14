import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** Shown before the title, such as an area's color square. */
  marker?: ReactNode;
  /** One line under the title (an area's vision, or what the page answers). */
  description?: string | null;
  actions?: ReactNode;
};

/** The page header: 24 px gutter, a 32 px title row, and actions on the right. */
export function PageHeader({ title, marker, description, actions }: PageHeaderProps) {
  return (
    <header className="flex shrink-0 items-start gap-4 px-(--page-gutter) pt-(--page-gutter)">
      <div className="min-w-0">
        <div className="flex h-(--page-header-height) items-center gap-2.5">
          {marker}
          <h1 className="truncate type-page-title text-(--page-title)">{title}</h1>
        </div>
        {description && (
          <p
            className={`max-w-[760px] type-body text-(--text-secondary) ${marker ? "pl-[22px]" : ""}`}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
