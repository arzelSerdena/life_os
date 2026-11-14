import { Button, Dropdown, Label } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowDownUp, ChartLine, Ellipsis, LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { listLifeAreasOptions } from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { PageHeader } from "../../components/PageHeader";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { CardEmpty, SectionCard } from "../../components/SectionCard";
import { type Period, periodInSentence, periodRange, today } from "../../period";
import { usePeriodStore } from "../../stores/periodStore";
import { useAreasContext } from "./AreasLayout";
import { type AreaPaletteKey, areaDataAttribute } from "./palette";
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
          (hasAreas ? (
            <OverviewCards lifeAreas={lifeAreas.data} />
          ) : (
            <FirstAreaWelcome onCreate={openCreateForm} />
          ))}
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

/**
 * The overview's cards. Their data comes with the overview API; until then each shows
 * the empty state the mock-up gives for areas with no data yet.
 */
function OverviewCards({ lifeAreas }: { lifeAreas: readonly LifeAreaRead[] }) {
  const { period, date } = usePeriodStore();
  const name = periodInSentence(period, date);
  const isCurrent = containsToday(period, date);

  const effort = isCurrent ? `No tasks completed in ${name} yet` : `No tasks completed in ${name}`;
  return (
    <>
      <SectionCard title="Effort" description={effort}>
        <CardEmpty>{effort}.</CardEmpty>
      </SectionCard>
      <SectionCard title="Outcomes" description="No metrics yet">
        <div className="grid grid-cols-5 gap-3">
          {lifeAreas.map((lifeArea) => (
            <OutcomesAreaPanel key={lifeArea.id} lifeArea={lifeArea} />
          ))}
        </div>
      </SectionCard>
      <div className="grid grid-cols-3 gap-4">
        <SectionCard title="Projects" description="No active projects">
          <CardEmpty>No active projects.</CardEmpty>
        </SectionCard>
        <SectionCard title="Routine steps done" description="No routine steps">
          <CardEmpty>No routine steps in these areas.</CardEmpty>
        </SectionCard>
        <SectionCard
          title="Wins"
          description={isCurrent ? `None in ${name} yet` : `None in ${name}`}
        >
          <CardEmpty>{isCurrent ? `Nothing yet this ${period}.` : `Nothing in ${name}.`}</CardEmpty>
        </SectionCard>
      </div>
    </>
  );
}

/** One area's grey panel in Outcomes; for now its dashed "no metrics" placeholder. */
function OutcomesAreaPanel({ lifeArea }: { lifeArea: LifeAreaRead }) {
  return (
    <div
      data-area={areaDataAttribute(lifeArea.color)}
      className="self-start rounded-(--radius-12) border border-[#eef0f3] bg-neutral-50 px-2 pt-1.5 pb-2"
    >
      <h3 className="mb-1 flex h-7 items-center gap-2 pl-0.5">
        <span aria-hidden className="size-2.5 shrink-0 rounded-[2px] bg-(--area-solid)" />
        <span className="truncate text-sm font-semibold text-(--text-primary)">
          {lifeArea.title}
        </span>
        <span className="shrink-0 type-meta font-normal text-(--text-tertiary)">No metrics</span>
      </h3>
      <div className="flex min-h-[120px] flex-col justify-center gap-1.5 rounded-(--radius-8) border border-dashed border-(--border-default) bg-(--bg-surface) px-2.5 py-2 text-xs text-(--text-tertiary)">
        <ChartLine aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />
        <span>No metrics yet</span>
      </div>
    </div>
  );
}

function containsToday(period: Period, date: string): boolean {
  const { start, end } = periodRange(period, date);
  const now = today();
  return start <= now && now <= end;
}
