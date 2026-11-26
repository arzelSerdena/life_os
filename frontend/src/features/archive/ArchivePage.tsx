import { Button, Popover, Tooltip } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Folder,
  type LucideIcon,
  Repeat,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { type MouseEvent, type ReactNode, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  archiveProjectMutation,
  getArchiveOptions,
  listLifeAreasOptions,
  listProjectsOptions,
  reopenProjectMutation,
  unarchiveLifeAreaMutation,
  unarchiveProjectMutation,
  unarchiveRoutineMutation,
} from "../../client/@tanstack/react-query.gen";
import type {
  ArchivedAreaRead,
  ArchivedRoutineRead,
  ArchiveRead,
  FinishedProjectRead,
  LifeAreaRead,
} from "../../client/types.gen";
import { QueryError } from "../../components/QueryError";
import { Scroll } from "../../components/Scroll";
import { SegmentSwitch } from "../../components/SegmentSwitch";
import { useChangeToast } from "../../stores/changeToastStore";
import { PANEL_OPENER, useDetailPanel } from "../../stores/detailPanelStore";
import { DeleteRoutineDialog } from "../deleting/deleteDialogs";
import { type PanelAction, PanelMenu } from "../detail-panel/PanelParts";
import { useRowContextMenu } from "../item-menu/PointMenu";
import { DeleteLifeAreaDialog } from "../life-areas/DeleteLifeAreaDialog";
import { areaDataAttribute } from "../life-areas/palette";
import { DeleteProjectDialog } from "../projects/DeleteProjectDialog";
import { projectPath } from "../projects/paths";
import { CheckRow, FILTER_TRIGGER, FiltersOnDot, Section } from "../tasks/FilterMenu";
import {
  ARCHIVE_TABS,
  type ArchiveTab,
  areaMeta,
  EMPTY_MESSAGES,
  filterAreas,
  groupProjects,
  projectMeta,
  restoreBlocker,
  restoredAreaMessage,
  routineDeleteBlocker,
  routineMeta,
  tabOf,
} from "./archive";

const ICON = "size-4";
const THIS_YEAR = new Date().getFullYear();

type Deleting =
  | { kind: "area"; area: ArchivedAreaRead }
  | { kind: "project"; id: number }
  | { kind: "routine"; routine: ArchivedRoutineRead };

/**
 * Finished & archived (approved-archived.html, with the Nov 16 decisions): the Areas |
 * Projects | Routines switch, then one list, newest first. Areas open the read-only detail
 * panel, projects their page and routines their read-only page. Restore and Reopen apply at
 * once with the undo toast; Delete asks first.
 */
export function ArchivePage() {
  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get("tab"));
  const [hiddenAreas, setHiddenAreas] = useState<number[]>([]);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const archive = useQuery(getArchiveOptions());
  const lifeAreas = useQuery(listLifeAreasOptions({ query: { include_archived: true } })).data;
  const data = archive.data;

  const counts: Record<ArchiveTab, number> = {
    areas: data?.areas.length ?? 0,
    projects: data?.projects.length ?? 0,
    routines: data?.routines.length ?? 0,
  };

  return (
    <>
      <header className="box-content flex h-(--page-header-height) shrink-0 items-center gap-3 px-(--page-gutter) pt-(--page-gutter)">
        <h1 className="truncate type-page-title text-(--page-title)">Finished & archived</h1>
        <span aria-hidden className="h-5 w-px bg-(--border-default)" />
        <SegmentSwitch
          label="Show"
          value={tab}
          options={ARCHIVE_TABS.map((option) => ({ ...option, count: counts[option.key] }))}
          onChange={(next) => setParams(next === "areas" ? {} : { tab: next }, { replace: true })}
        />
        <div className="ml-auto flex items-center gap-2">
          {tab === "projects" && data && data.projects.length > 0 && lifeAreas && (
            <AreaFilter
              projects={data.projects}
              lifeAreas={lifeAreas}
              hidden={hiddenAreas}
              onChange={setHiddenAreas}
            />
          )}
        </div>
      </header>
      <Scroll
        direction="both"
        className="flex min-h-0 flex-1 flex-col px-(--page-gutter) pt-4 pb-(--page-gutter)"
      >
        {archive.isError ? (
          <QueryError error={archive.error} onRetry={archive.refetch} />
        ) : !data || !lifeAreas ? (
          <p className="type-meta text-(--text-tertiary)">Loading…</p>
        ) : (
          <section
            aria-label={ARCHIVE_TABS.find((option) => option.key === tab)?.label}
            className="w-full max-w-[960px] rounded-(--radius-12) border border-(--card-border) bg-(--bg-surface) py-1"
          >
            {tab === "areas" && <AreaRows data={data} onDelete={setDeleting} />}
            {tab === "projects" && (
              <ProjectRows
                data={data}
                lifeAreas={lifeAreas}
                hiddenAreas={hiddenAreas}
                onDelete={setDeleting}
              />
            )}
            {tab === "routines" && <RoutineRows data={data} onDelete={setDeleting} />}
          </section>
        )}
      </Scroll>
      {deleting && <DeleteDialog target={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

function Empty({ tab }: { tab: ArchiveTab }) {
  return <p className="px-4 py-4 type-meta text-(--text-tertiary)">{EMPTY_MESSAGES[tab]}</p>;
}

// ---------- Rows ----------

function useRestoreToast() {
  return useChangeToast((state) => state.show);
}

function AreaRows({ data, onDelete }: { data: ArchiveRead; onDelete: (target: Deleting) => void }) {
  const openPanel = useDetailPanel((state) => state.open);
  const toast = useRestoreToast();
  const restore = useMutation(unarchiveLifeAreaMutation());
  if (data.areas.length === 0) return <Empty tab="areas" />;
  return (
    <>
      {restore.isError && <RowError error={restore.error} />}
      {data.areas.map((area) => {
        const onRestore = () =>
          restore.mutate(
            { path: { life_area_id: area.id } },
            { onSuccess: (change) => toast(restoredAreaMessage(area), change.batch_id) },
          );
        return (
          <Row
            key={area.id}
            color={area.color}
            icon={<span className="size-2.5 rounded-[3px] bg-(--area-solid)" />}
            title={area.title}
            meta={areaMeta(area, THIS_YEAR)}
            onOpen={() => openPanel({ kind: "area", id: area.id })}
            opensPanel
            quick={{ label: "Restore", icon: ArchiveRestore, onPress: onRestore }}
            actions={[
              {
                id: "restore",
                label: "Restore area",
                icon: ArchiveRestore,
                onAction: onRestore,
              },
              {
                id: "delete",
                label: "Delete area",
                icon: Trash2,
                isDanger: true,
                isDisabled: area.has_items,
                hint: area.has_items ? "Only empty areas can be deleted." : undefined,
                onAction: () => onDelete({ kind: "area", area }),
              },
            ]}
          />
        );
      })}
    </>
  );
}

function ProjectRows({
  data,
  lifeAreas,
  hiddenAreas,
  onDelete,
}: {
  data: ArchiveRead;
  lifeAreas: LifeAreaRead[];
  hiddenAreas: number[];
  onDelete: (target: Deleting) => void;
}) {
  const navigate = useNavigate();
  const toast = useRestoreToast();
  const restore = useMutation(unarchiveProjectMutation());
  const reopen = useMutation(reopenProjectMutation());
  const archive = useMutation(archiveProjectMutation());
  const error = restore.error ?? reopen.error ?? archive.error;
  const groups = groupProjects(data.projects, hiddenAreas);
  if (data.projects.length === 0) return <Empty tab="projects" />;
  if (groups.length === 0) {
    return (
      <p className="px-4 py-4 type-meta text-(--text-tertiary)">No projects match the filter.</p>
    );
  }

  const row = (project: FinishedProjectRead) => {
    const area = lifeAreas.find((item) => item.id === project.life_area_id);
    const path = { project_id: project.id };
    const isArchived = project.archived_at !== null;
    const blocker = restoreBlocker(project, lifeAreas);
    const onRestore = () =>
      restore.mutate(
        { path },
        { onSuccess: (change) => toast(`Restored “${project.title}”`, change.batch_id) },
      );
    const onReopen = () =>
      reopen.mutate(
        { path },
        { onSuccess: (change) => toast(`Reopened “${project.title}”`, change.batch_id) },
      );
    const onArchive = () =>
      archive.mutate(
        { path },
        { onSuccess: (change) => toast(`Archived “${project.title}”`, change.batch_id) },
      );
    const blocked = blocker ? `Restore ${blocker} first.` : undefined;
    const statusActions: PanelAction[] = isArchived
      ? [
          {
            id: "restore",
            label: "Restore project",
            icon: ArchiveRestore,
            onAction: onRestore,
            isDisabled: blocker !== null,
            hint: blocked,
          },
        ]
      : [
          { id: "reopen", label: "Reopen project", icon: RotateCcw, onAction: onReopen },
          { id: "archive", label: "Archive project", icon: Archive, onAction: onArchive },
        ];
    return (
      <Row
        key={project.id}
        color={area?.color ?? null}
        icon={<Folder aria-hidden className="size-4 text-(--area-solid)" strokeWidth={2} />}
        title={project.title}
        meta={projectMeta(project, area?.title, THIS_YEAR)}
        onOpen={() => navigate(projectPath(project.id))}
        quick={
          isArchived
            ? { label: "Restore", icon: ArchiveRestore, onPress: onRestore, blocked }
            : { label: "Reopen", icon: RotateCcw, onPress: onReopen }
        }
        actions={[
          ...statusActions,
          {
            id: "delete",
            label: "Delete project",
            icon: Trash2,
            isDanger: true,
            isDisabled: project.has_items,
            hint: project.has_items ? "Only empty projects can be deleted." : undefined,
            onAction: () => onDelete({ kind: "project", id: project.id }),
          },
        ]}
      />
    );
  };

  return (
    <>
      {error && <RowError error={error} />}
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="not-first:mt-1">
          <h2 className="flex h-8 items-center gap-1.5 px-4 pt-2 type-label text-(--text-tertiary)">
            {group.label}
            <span className="tabular-nums">{group.projects.length}</span>
          </h2>
          {group.projects.map(row)}
        </section>
      ))}
    </>
  );
}

function RoutineRows({
  data,
  onDelete,
}: {
  data: ArchiveRead;
  onDelete: (target: Deleting) => void;
}) {
  const navigate = useNavigate();
  const toast = useRestoreToast();
  const restore = useMutation(unarchiveRoutineMutation());
  if (data.routines.length === 0) return <Empty tab="routines" />;
  return (
    <>
      {restore.isError && <RowError error={restore.error} />}
      {data.routines.map((routine) => {
        const onRestore = () =>
          restore.mutate(
            { path: { routine_id: routine.id } },
            {
              onSuccess: (change) =>
                toast(
                  `Restored “${routine.title}”${routine.steps > 0 ? ` · ${routine.steps} ${routine.steps === 1 ? "step" : "steps"} back` : ""}`,
                  change.batch_id,
                ),
            },
          );
        const blocker = routineDeleteBlocker(routine);
        return (
          <Row
            key={routine.id}
            color={null}
            icon={
              <Repeat aria-hidden className="size-4 text-(--color-brand-600)" strokeWidth={2} />
            }
            title={routine.title}
            meta={routineMeta(routine, THIS_YEAR)}
            onOpen={() => navigate(`/areas/routines/${routine.id}`)}
            quick={{ label: "Restore", icon: ArchiveRestore, onPress: onRestore }}
            actions={[
              {
                id: "restore",
                label: "Restore routine",
                icon: ArchiveRestore,
                onAction: onRestore,
              },
              {
                id: "delete",
                label: "Delete routine",
                icon: Trash2,
                isDanger: true,
                isDisabled: blocker !== null,
                hint: blocker ?? undefined,
                onAction: () => onDelete({ kind: "routine", routine }),
              },
            ]}
          />
        );
      })}
    </>
  );
}

function RowError({ error }: { error: unknown }) {
  return (
    <div className="px-4 py-2">
      <QueryError error={error} />
    </div>
  );
}

type Quick = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Why it is disabled: "Restore Language learning first." */
  blocked?: string;
};

/**
 * A 44 px row: icon, name and one meta line. Hovering (or focusing inside) shows the quick
 * action and the ⋯ menu. Clicking the row opens the item, as its name does.
 */
function Row({
  color,
  icon,
  title,
  meta,
  onOpen,
  opensPanel = false,
  quick,
  actions,
}: {
  color: string | null;
  icon: ReactNode;
  title: string;
  meta: string;
  onOpen: () => void;
  opensPanel?: boolean;
  quick: Quick;
  actions: PanelAction[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rowMenu = useRowContextMenu(actions, `More actions for “${title}”`);
  const onRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a, [role=menu]")) return;
    onOpen();
  };
  const tipId = `blocked-${title.replace(/\W+/g, "-")}`;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: the name is the keyboard target; the row only widens the mouse target
    <div
      data-area={areaDataAttribute(color)}
      {...(opensPanel ? PANEL_OPENER : {})}
      onClick={onRowClick}
      onContextMenu={rowMenu.onContextMenu}
      className="group relative flex h-11 cursor-pointer items-center gap-2.5 pr-3 pl-4 not-first-of-type:shadow-[inset_0_1px_0_var(--color-neutral-100)] hover:bg-(--color-neutral-50) has-focus-visible:bg-(--color-neutral-50)"
    >
      <span aria-hidden className="grid size-4 shrink-0 place-items-center">
        {icon}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-[4px] text-left type-body leading-5 font-medium whitespace-nowrap text-(--text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
      >
        {title}
      </button>
      <span className="min-w-0 flex-1 truncate type-meta text-(--text-secondary) tabular-nums">
        {meta}
      </span>
      <span
        className={`ml-auto flex shrink-0 items-center gap-1 group-hover:visible group-has-focus-visible:visible ${
          menuOpen || rowMenu.isOpen ? "visible" : "invisible"
        }`}
      >
        <Tooltip delay={0} isDisabled={!quick.blocked}>
          <Tooltip.Trigger role="presentation" tabIndex={-1}>
            <Button
              size="sm"
              isDisabled={Boolean(quick.blocked)}
              aria-describedby={quick.blocked ? tipId : undefined}
              aria-label={`${quick.label} “${title}”`}
              onPress={quick.onPress}
            >
              <quick.icon aria-hidden className={ICON} />
              {quick.label}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{quick.blocked}</Tooltip.Content>
        </Tooltip>
        {quick.blocked && (
          <span id={tipId} className="sr-only">
            {quick.blocked}
          </span>
        )}
        <PanelMenu
          actions={actions}
          label={`More actions for “${title}”`}
          onOpenChange={setMenuOpen}
        />
      </span>
      {rowMenu.menu}
    </div>
  );
}

// ---------- Filter ----------

/** Projects only: show or hide each area's projects (archived areas are listed too). */
function AreaFilter({
  projects,
  lifeAreas,
  hidden,
  onChange,
}: {
  projects: FinishedProjectRead[];
  lifeAreas: LifeAreaRead[];
  hidden: number[];
  onChange: (hidden: number[]) => void;
}) {
  const rows = filterAreas(projects, lifeAreas);
  const on = rows.some((row) => hidden.includes(row.area.id));
  return (
    <Popover>
      <Popover.Trigger
        aria-label={on ? "Filter by area (filters on)" : "Filter by area"}
        className={FILTER_TRIGGER}
      >
        <SlidersHorizontal aria-hidden className="size-4" strokeWidth={2} />
        {on && <FiltersOnDot />}
      </Popover.Trigger>
      <Popover.Content placement="bottom end" className="w-[260px]">
        <Popover.Dialog
          aria-label="Filter by area"
          className="flex max-h-[min(640px,80vh)] flex-col overflow-y-auto p-1.5"
        >
          <Section label="Area" first>
            {rows.map(({ area, count }) => (
              <CheckRow
                key={area.id}
                label={area.title}
                checked={!hidden.includes(area.id)}
                trailing={count}
                onChange={() =>
                  onChange(
                    hidden.includes(area.id)
                      ? hidden.filter((id) => id !== area.id)
                      : [...hidden, area.id],
                  )
                }
              >
                <span
                  aria-hidden
                  data-area={areaDataAttribute(area.color)}
                  className="size-[9px] shrink-0 rounded-[2px] bg-(--area-solid)"
                />
              </CheckRow>
            ))}
          </Section>
          {on && (
            <>
              <div className="mx-1 my-1.5 h-px shrink-0 bg-(--border-default)" />
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex h-[30px] shrink-0 items-center gap-2 rounded-(--radius-6) px-2 text-left type-body text-(--text-primary) outline-none hover:bg-(--color-neutral-100) focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
              >
                <X aria-hidden className="size-[13px] text-(--text-tertiary)" strokeWidth={2} />
                Clear filters
              </button>
            </>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

// ---------- Delete ----------

function DeleteDialog({ target, onClose }: { target: Deleting; onClose: () => void }) {
  const projects = useQuery(listProjectsOptions({ query: { include_archived: true } })).data;
  if (target.kind === "area")
    return <DeleteLifeAreaDialog lifeArea={target.area} onClose={onClose} />;
  if (target.kind === "routine") {
    return <DeleteRoutineDialog routine={target.routine} onClose={onClose} />;
  }
  // The project's sections are deleted with it, so the dialog lists them.
  const project = projects?.find((item) => item.id === target.id);
  return project ? <DeleteProjectDialog project={project} onClose={onClose} /> : null;
}
