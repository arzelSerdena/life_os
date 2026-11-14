import { Button, Dropdown, Label } from "@heroui/react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChartLine,
  ChevronDown,
  Folder,
  ListChecks,
  Plus,
  Repeat,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  getAreaPageOptions,
  getLifeAreaOptions,
  unarchiveLifeAreaMutation,
} from "../../client/@tanstack/react-query.gen";
import type { AreaPageRead } from "../../client/types.gen";
import { PageHeader } from "../../components/PageHeader";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { SectionCard } from "../../components/SectionCard";
import { usePeriodStore } from "../../stores/periodStore";
import { ArchiveAreaDialog } from "./ArchiveAreaDialog";
import { AreaMenu } from "./AreaMenu";
import { useAreasContext } from "./AreasLayout";
import { NewMetricModal } from "./area/NewMetricModal";
import { ProjectsCard, RoutinesCard } from "./area/ProjectsAndRoutines";
import { AgendaCard, TasksCard } from "./area/TasksAndAgenda";
import { TimelineCard } from "./area/TimelineCard";
import { DeleteLifeAreaDialog } from "./DeleteLifeAreaDialog";
import { outcomeTone, plural } from "./overview/format";
import { MetricTile } from "./overview/OutcomesCard";
import { areaDataAttribute } from "./palette";

/** One life area's page over the selected period. */
export function AreaPage() {
  const lifeAreaId = Number(useParams().areaId);
  const navigate = useNavigate();
  const { openEditForm } = useAreasContext();
  const { period, date } = usePeriodStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingMetric, setIsAddingMetric] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const lifeArea = useQuery(getLifeAreaOptions({ path: { life_area_id: lifeAreaId } }));
  const page = useQuery({
    ...getAreaPageOptions({ path: { life_area_id: lifeAreaId }, query: { period, date } }),
    placeholderData: keepPreviousData,
  });
  const restore = useMutation(unarchiveLifeAreaMutation());
  const actionError = restore.error;

  if (lifeArea.isPending) return null;
  if (lifeArea.isError) {
    return (
      <div className="p-(--page-gutter)">
        <QueryError error={lifeArea.error} />
      </div>
    );
  }

  const area = lifeArea.data;
  const isArchived = area.archived_at !== null;
  const path = { path: { life_area_id: area.id } };
  return (
    <div data-area={areaDataAttribute(area.color)} className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={area.title}
        description={area.vision}
        marker={<span aria-hidden className="size-3 shrink-0 rounded-[3px] bg-(--area-solid)" />}
        actions={
          <>
            {!isArchived && <PeriodSwitch />}
            <AreaMenu
              lifeArea={area}
              canDelete={page.data ? !page.data.contents.has_items : false}
              onEdit={() => openEditForm(area)}
              onArchive={() => setIsArchiving(true)}
              onRestore={() => restore.mutate(path)}
              onDelete={() => setIsDeleting(true)}
            />
            {!isArchived && <AddMenu onAddMetric={() => setIsAddingMetric(true)} />}
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-(--page-gutter) pt-4 pb-(--page-gutter)">
        {isArchived && (
          <p className="type-body text-(--text-tertiary)">
            This area is archived. Restore it to plan in it again.
          </p>
        )}
        {actionError && <QueryError error={actionError} />}
        {page.isError && <QueryError error={page.error} onRetry={page.refetch} />}
        {page.data && <AreaCards page={page.data} onAddMetric={() => setIsAddingMetric(true)} />}
      </div>
      {isDeleting && (
        <DeleteLifeAreaDialog
          lifeArea={area}
          onClose={() => setIsDeleting(false)}
          onDeleted={() => navigate("/areas", { replace: true })}
        />
      )}
      {isArchiving && page.data && (
        <ArchiveAreaDialog
          lifeArea={area}
          contents={page.data.contents}
          onClose={() => setIsArchiving(false)}
          onArchived={() => navigate("/areas")}
        />
      )}
      {isAddingMetric && (
        <NewMetricModal lifeArea={area} onClose={() => setIsAddingMetric(false)} />
      )}
    </div>
  );
}

function AreaCards({ page, onAddMetric }: { page: AreaPageRead; onAddMetric: () => void }) {
  const behind = page.metrics.filter((m) => outcomeTone(m.status) === "bad").length;
  const untargeted = page.metrics.filter((m) => m.target === null).length;
  const description =
    page.metrics.length === 0
      ? undefined
      : [
          `${plural(page.metrics.length, "metric")} owned by ${page.life_area.title}`,
          behind && `${behind} behind`,
          untargeted && `${untargeted} without a target`,
        ]
          .filter(Boolean)
          .join(" · ");
  return (
    <>
      <SectionCard title="Metrics" description={description}>
        {page.metrics.length === 0 ? (
          <div className="flex min-h-10 items-center gap-3 type-meta text-(--text-tertiary)">
            No metrics yet.
            <Button
              variant="ghost"
              size="sm"
              onPress={onAddMetric}
              className="text-(--text-secondary)"
            >
              <Plus aria-hidden />
              Add metric
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {page.metrics.map((outcome) => (
              <MetricTile key={outcome.metric_id} outcome={outcome} view={page} />
            ))}
          </div>
        )}
      </SectionCard>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-4">
        <div className="flex min-w-0 flex-col gap-4">
          <TimelineCard page={page} />
          <ProjectsCard page={page} />
          <RoutinesCard page={page} />
          <TasksCard page={page} />
        </div>
        <AgendaCard page={page} />
      </div>
    </>
  );
}

const ADD_ICON = "size-4 shrink-0 text-(--text-tertiary)";

/** The Add button in the area's color. Only metrics can be added here so far; the other
 * items get their forms with their own screens. */
function AddMenu({ onAddMetric }: { onAddMetric: () => void }) {
  return (
    <Dropdown>
      <Button className="gap-0 bg-(--area-solid) px-0 text-white">
        <span className="flex items-center gap-1.5 px-2.5">
          <Plus aria-hidden />
          Add
        </span>
        <span aria-hidden className="h-4 w-px bg-white/40" />
        <span className="grid place-items-center px-1.5">
          <ChevronDown aria-hidden />
        </span>
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[200px]">
        <Dropdown.Menu
          aria-label="Add to this area"
          disabledKeys={["task", "event", "project", "step"]}
          onAction={(key) => key === "metric" && onAddMetric()}
        >
          <Dropdown.Item id="task" textValue="Task">
            <ListChecks aria-hidden className={ADD_ICON} />
            <Label>Task</Label>
          </Dropdown.Item>
          <Dropdown.Item id="event" textValue="Event">
            <CalendarDays aria-hidden className={ADD_ICON} />
            <Label>Event</Label>
          </Dropdown.Item>
          <Dropdown.Item id="project" textValue="Project">
            <Folder aria-hidden className={ADD_ICON} />
            <Label>Project</Label>
          </Dropdown.Item>
          <Dropdown.Item id="metric" textValue="Metric">
            <ChartLine aria-hidden className={ADD_ICON} />
            <Label>Metric</Label>
          </Dropdown.Item>
          <Dropdown.Item id="step" textValue="Routine step">
            <Repeat aria-hidden className={ADD_ICON} />
            <Label>Routine step</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
