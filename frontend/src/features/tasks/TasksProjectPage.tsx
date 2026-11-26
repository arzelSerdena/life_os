import { Folder } from "lucide-react";
import { useParams } from "react-router";
import { QueryError } from "../../components/QueryError";
import { SegmentSwitch } from "../../components/SegmentSwitch";
import { useTaskBoard } from "../../stores/taskBoardStore";
import { PanelLink } from "../detail-panel/PanelLink";
import { areaDataAttribute } from "../life-areas/palette";
import { ProjectBoard } from "../projects/ProjectBoard";
import { FilterMenu } from "./FilterMenu";
import { NewTaskButton } from "./NewTaskModal";
import { usePageSpot } from "./newTaskShortcut";
import { useTasksContext } from "./TasksLayout";

/** A project's task board inside the Tasks layout, matching the other Tasks board screens. */
export function TasksProjectPage() {
  const projectId = Number(useParams().projectId);
  const { data, error } = useTasksContext();
  const group = useTaskBoard((state) => state.projectGroup);
  const setGroup = useTaskBoard((state) => state.setProjectGroup);

  const project = data?.projects.find((p) => p.id === projectId);
  const area = project ? data?.lifeAreas.find((a) => a.id === project.life_area_id) : undefined;
  const base = project && area ? { lifeAreaId: area.id, projectId: project.id } : {};
  usePageSpot(base, data?.today);

  if (error) {
    return (
      <div className="p-(--page-gutter)">
        <QueryError error={error} />
      </div>
    );
  }
  if (!data) {
    return <p className="p-(--page-gutter) type-meta text-(--text-tertiary)">Loading…</p>;
  }
  if (!project || !area) {
    return (
      <div className="p-(--page-gutter)">
        <p className="type-body text-(--text-secondary)">Project not found.</p>
      </div>
    );
  }

  const canAdd =
    project.status === "active" && project.archived_at === null && area.archived_at === null;

  return (
    <>
      <header className="box-content flex h-(--page-header-height) shrink-0 items-center gap-3 px-(--page-gutter) pt-(--page-gutter)">
        <Folder
          aria-hidden
          data-area={areaDataAttribute(area.color)}
          className="size-[18px] shrink-0 text-(--area-solid)"
          strokeWidth={2}
        />
        <h1 className="min-w-0 truncate type-page-title text-(--page-title)">
          <PanelLink
            openInPanel
            target={{ kind: "project", id: project.id }}
            className="type-page-title text-(--page-title)"
          >
            {project.title}
          </PanelLink>
        </h1>
        <span aria-hidden className="h-5 w-px shrink-0 bg-(--border-default)" />
        <SegmentSwitch
          label="Group by"
          value={group}
          options={[
            { key: "priority", label: "Priority" },
            { key: "section", label: "Section" },
          ]}
          onChange={setGroup}
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <FilterMenu view="project" layout={group} lifeAreas={[]} sections={project.sections} />
          {canAdd && <NewTaskButton spot={base} today={data.today} />}
        </div>
      </header>
      <ProjectBoard project={project} area={area} today={data.today} canAdd={canAdd} />
    </>
  );
}
