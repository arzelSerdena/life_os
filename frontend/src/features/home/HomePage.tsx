import { Button, Dropdown, Label } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, ChartLine, Check, ChevronDown, House, ListChecks, Plus } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  createTaskMutation,
  getHomeOptions,
  listLifeAreasOptions,
  listProjectsOptions,
} from "../../client/@tanstack/react-query.gen";
import type { HomeRead, LifeAreaRead, ProjectRead } from "../../client/types.gen";
import { PageHeader } from "../../components/PageHeader";
import { QueryError } from "../../components/QueryError";
import { useNewEvent } from "../../stores/newEventStore";
import { useNewTask } from "../../stores/newTaskStore";
import { usePendingDeletes } from "../../stores/pendingDeleteStore";
import type { RowContext } from "../calendar/AgendaRow";
import { LifeAreaFormModal } from "../life-areas/LifeAreaFormModal";
import { shortDate } from "../life-areas/overview/format";
import { nextFreePalette } from "../life-areas/palette";
import { WEEKDAY_NAMES, weekdayIndex } from "../pickers/dates";
import { NewRoutineModal } from "../routines/NewRoutineModal";
import { formatTime, useTimeFormat } from "../tasks/format";
import { usePageSpot } from "../tasks/newTaskShortcut";
import { comingUpDays, doneCount, isFirstRun, nextUp, withoutPending } from "./home";
import { LogTodayCard } from "./LogTodayCard";
import { RoutinesTodayCard } from "./RoutinesTodayCard";
import { ComingUpCard, PushCard } from "./SideCards";
import { TodayCard } from "./TodayCard";

/** The local time as "HH:MM". */
function readNow(): string {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** The local time, updated every half minute for the now line. */
function useNow(): string {
  const [now, setNow] = useState(readNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(readNow()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Home: today, right now. No sidebar and no period switch. */
export function HomePage() {
  const home = useQuery(getHomeOptions());
  const lifeAreas = useQuery(listLifeAreasOptions());
  const projectList = useQuery(listProjectsOptions());
  const pending = usePendingDeletes((state) => state.pending);
  const data = useMemo(() => home.data && withoutPending(home.data, pending), [home.data, pending]);
  const timeFormat = useTimeFormat();
  const now = useNow();
  const today = data?.today;
  usePageSpot({ scheduledDate: today }, today);

  const time = (value: string) => formatTime(value, timeFormat);
  const areas = lifeAreas.data ?? [];
  const projects = projectList.data ?? [];

  if (home.isError) {
    return (
      <main className="flex min-w-0 flex-1 flex-col p-(--page-gutter)">
        <QueryError error={home.error} onRetry={home.refetch} />
      </main>
    );
  }
  if (!data) return <main className="flex-1" />;

  const firstRun = isFirstRun(data);
  const { done, total } = doneCount(data);
  const next = nextUp(data, now, time);
  const line = [total > 0 && `${done} of ${total} done`, next && `Next: ${next}`]
    .filter(Boolean)
    .join(" · ");
  const title = `${WEEKDAY_NAMES[weekdayIndex(data.today)]}, ${shortDate(data.today)}`;

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={title}
        description={firstRun ? null : line || null}
        actions={
          <>
            <QuickAdd today={data.today} />
            <NewSplitButton today={data.today} />
          </>
        }
      />
      {firstRun ? (
        <FirstRun home={data} areas={areas} projects={projects} />
      ) : (
        <HomeGrid home={data} areas={areas} projects={projects} now={now} time={time} />
      )}
    </main>
  );
}

function HomeGrid({
  home,
  areas,
  projects,
  now,
  time,
}: {
  home: HomeRead;
  areas: LifeAreaRead[];
  projects: ProjectRead[];
  now: string;
  time: (value: string) => string;
}) {
  const colorOf = (lifeAreaId: number | null) =>
    areas.find((area) => area.id === lifeAreaId)?.color ?? null;
  const context: RowContext = {
    today: home.today,
    colorOf,
    projects,
    areaName: (lifeAreaId) => areas.find((area) => area.id === lifeAreaId)?.title ?? null,
    // Routine steps have their own card; agenda rows on Home never show a routine.
    onRoutine: () => {},
  };
  const days = comingUpDays(home, time);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px] items-start gap-4 overflow-auto px-(--page-gutter) pt-4 pb-(--page-gutter)">
      <div className="flex min-w-0 flex-col gap-4">
        <TodayCard home={home} context={context} now={now} nowLabel={time(now)} time={time} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <RoutinesTodayCard home={home} colorOf={colorOf} projects={projects} />
        <LogTodayCard metrics={home.log} colorOf={colorOf} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <PushCard home={home} colorOf={colorOf} projects={projects} />
        <ComingUpCard home={home} days={days} context={context} />
      </div>
    </div>
  );
}

/** "Add task": Enter creates a task scheduled today with no owner, so it is in the Inbox too. */
function QuickAdd({ today }: { today: string }) {
  const [title, setTitle] = useState("");
  const create = useMutation(createTaskMutation());
  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    create.mutate(
      { body: { title: trimmed, scheduled_date: today } },
      { onSuccess: () => setTitle("") },
    );
  };
  return (
    <div className="flex flex-col items-end">
      <label className="flex h-8 w-[340px] cursor-text items-center gap-2 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-200">
        <Plus aria-hidden className="size-[15px] shrink-0 text-(--text-tertiary)" />
        <input
          aria-label="Add task"
          placeholder="Add task"
          value={title}
          disabled={create.isPending}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") setTitle("");
          }}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-(--text-primary) outline-none placeholder:text-(--text-disabled)"
        />
      </label>
      {create.isError && (
        <p role="alert" className="type-meta text-(--text-danger)">
          Couldn't add the task. Try again.
        </p>
      )}
    </div>
  );
}

const ICON = "size-4 shrink-0 text-(--text-tertiary)";

/** New task (scheduled today), and ▾ for Task, Event and Metric entry (not drawn yet). */
function NewSplitButton({ today }: { today: string }) {
  const openNewTask = useNewTask((state) => state.open);
  const openNewEvent = useNewEvent((state) => state.open);
  const newTask = () => openNewTask({ scheduledDate: today }, today);
  return (
    <div className="flex">
      <Button onPress={newTask} className="rounded-r-none">
        <Plus aria-hidden strokeWidth={2} />
        New task
      </Button>
      <Dropdown>
        <Button
          isIconOnly
          aria-label="More to create"
          className="w-[30px] min-w-0 rounded-l-none before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-white/35"
        >
          <ChevronDown aria-hidden />
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-[220px]">
          <Dropdown.Menu
            aria-label="Create"
            disabledKeys={["entry"]}
            onAction={(key) => {
              if (key === "task") newTask();
              if (key === "event") openNewEvent({ day: today }, today);
            }}
          >
            <MenuItem id="task" label="Task" icon={<ListChecks aria-hidden className={ICON} />} />
            <MenuItem
              id="event"
              label="Event"
              icon={<CalendarDays aria-hidden className={ICON} />}
            />
            <MenuItem
              id="entry"
              label="Metric entry"
              icon={<ChartLine aria-hidden className={ICON} />}
            />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

function MenuItem({ id, label, icon }: { id: string; label: string; icon: ReactNode }) {
  return (
    <Dropdown.Item id={id} textValue={label}>
      {icon}
      <Label>{label}</Label>
    </Dropdown.Item>
  );
}

/** "Set up Life OS": Life area, Routine and Task, each with its status and New button, and a
 * green check once that kind exists. */
function FirstRun({
  home,
  areas,
  projects,
}: {
  home: HomeRead;
  areas: LifeAreaRead[];
  projects: ProjectRead[];
}) {
  const [creating, setCreating] = useState<"area" | "routine" | null>(null);
  const openNewTask = useNewTask((state) => state.open);
  const navigate = useNavigate();
  const activeAreas = areas.filter((area) => area.archived_at === null);
  const activeProjects = projects.filter(
    (project) => project.status === "active" && project.archived_at === null,
  );
  const { setup } = home;
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-auto px-(--page-gutter) pb-16">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-(--radius-12) bg-brand-50 text-brand-700">
          <House aria-hidden className="size-6" strokeWidth={2} />
        </span>
        <h2 className="type-page-title text-(--text-primary)">Set up Life OS</h2>
        <p className="type-body text-(--text-secondary)">
          Life areas hold your projects, tasks and metrics. Routines are steps you repeat on a
          schedule.
        </p>
        <ul
          aria-label="Setup"
          className="mt-3 w-full rounded-(--radius-12) border border-(--border-default) px-4 py-1 text-left"
        >
          <SetupRow
            label="Life area"
            name={setup.life_area}
            action="New area"
            onPress={() => setCreating("area")}
          />
          <SetupRow
            label="Routine"
            name={setup.routine}
            action="New routine"
            onPress={() => setCreating("routine")}
          />
          <SetupRow
            label="Task"
            name={setup.task}
            action="New task"
            onPress={() => openNewTask({ scheduledDate: home.today }, home.today)}
          />
        </ul>
      </div>
      {creating === "area" && (
        <LifeAreaFormModal
          lifeAreas={activeAreas}
          defaultColor={nextFreePalette(activeAreas)}
          onClose={() => setCreating(null)}
        />
      )}
      {creating === "routine" && (
        <NewRoutineModal
          today={home.today}
          lifeAreas={activeAreas}
          projects={activeProjects}
          onClose={() => setCreating(null)}
          onCreated={(routine) => {
            setCreating(null);
            navigate(`/areas/routines/${routine.id}`);
          }}
        />
      )}
    </div>
  );
}

function SetupRow({
  label,
  name,
  action,
  onPress,
}: {
  label: string;
  name: string | null;
  action: string;
  onPress: () => void;
}) {
  const done = name !== null;
  return (
    <li className="flex min-h-14 items-center gap-3 not-first:border-t not-first:border-(--color-neutral-100)">
      {done ? (
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-(--color-positive-600) text-white">
          <Check aria-label="Done" className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-hidden
          className="size-5 shrink-0 rounded-full border-2 border-dashed border-(--color-neutral-300)"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-(--text-primary)">{label}</span>
        <span className="truncate type-meta text-(--text-tertiary)">{name ?? "None yet"}</span>
      </span>
      {!done && (
        <Button size="sm" variant="secondary" onPress={onPress}>
          <Plus aria-hidden />
          {action}
        </Button>
      )}
    </li>
  );
}
