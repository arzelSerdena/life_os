import { Button, Dropdown, Label } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowDownUp, Ellipsis, LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { listLifeAreasOptions } from "../../client/@tanstack/react-query.gen";
import { PageHeader } from "../../components/PageHeader";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { useAreasContext } from "./AreasLayout";
import { OverviewCards } from "./overview/OverviewCards";
import type { AreaPaletteKey } from "./palette";
import { ReorderAreasModal } from "./ReorderAreasModal";

/** Common areas offered when there are none yet; each opens the pop-up filled in. */
const QUICK_STARTS: { title: string; color: AreaPaletteKey }[] = [
  { title: "Career", color: "blue" },
  { title: "Finance", color: "teal" },
  { title: "Health", color: "rose" },
  { title: "Personal", color: "plum" },
  { title: "Relationships", color: "ochre" },
  { title: "Home", color: "terracotta" },
];

/** The overview behind the LIFE AREAS heading: compares the areas over one period. */
export function AreasOverviewPage() {
  const { openCreateForm } = useAreasContext();
  const navigate = useNavigate();
  const lifeAreas = useQuery(listLifeAreasOptions());
  const hasAreas = (lifeAreas.data?.length ?? 0) > 0;
  const [isReordering, setIsReordering] = useState(false);
  const menuActions: Record<string, () => void> = {
    reorder: () => setIsReordering(true),
    archived: () => navigate("/areas/archived"),
  };

  return (
    <>
      <PageHeader
        title="Life areas"
        actions={
          <>
            <PeriodSwitch isDisabled={!hasAreas} />
            <Dropdown>
              <Button
                isIconOnly
                variant="secondary"
                aria-label="More actions"
                isDisabled={!hasAreas}
                className="size-7 min-w-0 border border-(--button-secondary-border) bg-(--bg-surface) px-0 text-(--button-secondary-text) [&_svg]:size-4"
              >
                <Ellipsis aria-hidden />
              </Button>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu onAction={(key) => menuActions[String(key)]()}>
                  <Dropdown.Item id="reorder" textValue="Reorder areas">
                    <ArrowDownUp aria-hidden className={MENU_ICON} />
                    <Label>Reorder areas</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="archived" textValue="Archived areas">
                    <Archive aria-hidden className={MENU_ICON} />
                    <Label>Archived areas</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
            <Button onPress={() => openCreateForm()}>
              <Plus aria-hidden />
              New area
            </Button>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-(--page-gutter) pt-4 pb-(--page-gutter)">
        {lifeAreas.isError && <QueryError error={lifeAreas.error} onRetry={lifeAreas.refetch} />}
        {lifeAreas.isSuccess &&
          (hasAreas ? <OverviewCards /> : <FirstAreaWelcome onCreate={openCreateForm} />)}
      </div>
      {isReordering && lifeAreas.data && (
        <ReorderAreasModal lifeAreas={lifeAreas.data} onClose={() => setIsReordering(false)} />
      )}
    </>
  );
}

const MENU_ICON = "size-4 shrink-0 text-(--text-tertiary)";

function FirstAreaWelcome({
  onCreate,
}: {
  onCreate: (prefill?: { title: string; color: AreaPaletteKey }) => void;
}) {
  return (
    <div className="m-auto flex max-w-[520px] flex-col items-center gap-3 pb-20 text-center">
      <div className="grid size-12 place-items-center rounded-(--radius-12) bg-brand-100 text-brand-700">
        <LayoutGrid aria-hidden className="size-6" strokeWidth={2} />
      </div>
      <h2 className="type-page-title text-(--text-primary)">Set up your first life area</h2>
      <p className="text-sm text-(--text-secondary)">
        A life area is a part of your life you want to look after, like your career or your health.
        Projects, tasks, events, routines and metrics all live inside one.
      </p>
      <Button onPress={() => onCreate()} className="h-9 px-4 text-[13px]">
        <Plus aria-hidden />
        New area
      </Button>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
        <p className="mb-0.5 w-full type-meta text-(--text-tertiary)">
          Or start from a common one:
        </p>
        {QUICK_STARTS.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            data-area={suggestion.color}
            onClick={() => onCreate(suggestion)}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-(--border-default) bg-(--bg-surface) px-2.5 text-xs font-medium text-(--text-primary) outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
          >
            <span aria-hidden className="size-2 rounded-[2px] bg-(--area-solid)" />
            {suggestion.title}
          </button>
        ))}
      </div>
    </div>
  );
}
