import { Button } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  editEventOccurrenceMutation,
  getDaysOptions,
  getDaysQueryKey,
  listEventsOptions,
  listLifeAreasOptions,
  listProjectsOptions,
  listTasksOptions,
  rescheduleEventMutation,
  rescheduleProjectMutation,
  updateRoutineMutation,
  updateTaskMutation,
} from "../../client/@tanstack/react-query.gen";
import type { DaysRead, EventChange, ProjectRead } from "../../client/types.gen";
import { AnchoredPopover } from "../../components/AnchoredPopover";
import { QueryError } from "../../components/QueryError";
import { today as localToday } from "../../period";
import { useCalendarStore } from "../../stores/calendarStore";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { useNewEvent } from "../../stores/newEventStore";
import { useNewTask } from "../../stores/newTaskStore";
import { isPendingDelete, usePendingDeletes } from "../../stores/pendingDeleteStore";
import { monthName, shortDate } from "../life-areas/overview/format";
import { usePageSpot } from "../tasks/newTaskShortcut";
import type { RoutineDay } from "../tasks/next7";
import { dayName } from "../tasks/useFileTask";
import type { RowContext } from "./AgendaRow";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarHeader } from "./CalendarHeader";
import { AgendaPanel, InboxPanel } from "./CalendarPanel";
import {
  AddMenu,
  DayPopover,
  EntryPreviewPopover,
  HiddenBarsPopover,
  RoutinePopover,
} from "./CalendarPopovers";
import { CalendarSidebar } from "./CalendarSidebar";
import {
  agendaDays,
  applyMove,
  buildEntries,
  DEFAULT_FILTERS,
  type Entry,
  inboxPanelTasks,
  isFiltered,
  isLinear,
  routineTotals,
  shiftEvent,
  spanLabel,
  viewRange,
} from "./calendar";
import { useCalendarKeys } from "./calendarKeys";
import { type EventEditScope, EventScopeDialog } from "./EventScopeDialog";
import { LinearCalendar } from "./LinearCalendar";
import { type MonthRow, projectBars, splitEntries } from "./linear";
import {
  changesDates,
  type DaySpan,
  type DragSubject,
  projectDates,
  withPreview,
} from "./linearDrag";
import { DragOverlay, useLinearDrag } from "./useLinearDrag";

/**
 * What is open over the grid: a day's routines, "+3 more" (or a day of Quarter and Year), the
 * bars Year had no room for, or the add menu of a day.
 */
type Open =
  | { kind: "routine"; day: string; routineId: number | null; anchor: HTMLElement }
  | { kind: "day"; day: string; anchor: HTMLElement }
  | { kind: "entry"; entry: Entry; anchor: HTMLElement }
  | { kind: "hidden"; row: MonthRow; anchor: HTMLElement }
  | { kind: "add"; day: string; startTime?: string; endTime?: string; x: number; y: number };

type PendingEventMove = {
  event: Extract<Entry, { kind: "event" }>["event"];
  dates: { start_date: string; end_date: string | null };
  how: "move" | "resize";
  startTime?: string | null;
  endTime?: string | null;
  revert: () => void;
};

/**
 * The Calendar (Approved: Calendar): the sidebar's filters, the Week or Month day grid, and
 * the Agenda or Inbox on the right. Loading the range rolls unfinished tasks over to today
 * and creates its recurring tasks, as the Tasks boards do.
 */
export function CalendarPage() {
  const queryClient = useQueryClient();
  const {
    view,
    dayCount,
    timed,
    anchor: chosen,
    panel,
    inboxMode,
    setInboxMode,
    filters,
    setFilters,
  } = useCalendarStore();
  const showToast = useChangeToast((state) => state.show);
  const openPanel = useDetailPanel((state) => state.open);
  const openNewTask = useNewTask((state) => state.open);
  const openNewEvent = useNewEvent((state) => state.open);
  const pending = usePendingDeletes((state) => state.pending);
  const [open, setOpen] = useState<Open | null>(null);
  const [pendingEventMove, setPendingEventMove] = useState<PendingEventMove | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // The add menu anchors to a point: a 1 px mark where the day was clicked.
  const [addAnchor, setAddAnchor] = useState<HTMLSpanElement | null>(null);

  // Until the server says which day it is (Settings › Day ends at), the computer's date.
  const [serverToday, setServerToday] = useState<string | null>(null);
  const today = serverToday ?? localToday();
  const anchor = chosen ?? today;
  const range = viewRange(view, anchor, dayCount);
  const linear = isLinear(view);
  // Quarter and Year show no routines, so they don't load them.
  const daysQuery = {
    query: {
      start: range.start,
      count: range.count,
      include_cancelled: filters.show.cancelled,
      include_routines: !linear,
    },
  };
  const days = useQuery(getDaysOptions(daysQuery));
  if (days.data && days.data.today !== serverToday) setServerToday(days.data.today);
  const lifeAreas = useQuery(listLifeAreasOptions());
  const projects = useQuery(listProjectsOptions());
  const openTasks = useQuery(listTasksOptions({ query: { status: "todo" } }));
  // "Nothing created yet": no events and no tasks at all, not just none in this range.
  const anyEvents = useQuery(listEventsOptions({ query: { include_cancelled: true } }));
  const anyTasks = useQuery(listTasksOptions({ query: { include_cancelled: true } }));
  usePageSpot({}, days.data?.today);
  useCalendarKeys(anchor);

  const update = useMutation(updateTaskMutation());
  const updateRoutine = useMutation(updateRoutineMutation());
  const reschedule = useMutation(rescheduleEventMutation());
  const editOccurrence = useMutation(editEventOccurrenceMutation());
  const rescheduleProject = useMutation(rescheduleProjectMutation());

  const areas = (lifeAreas.data ?? []).filter((area) => area.archived_at === null);
  const activeProjects = (projects.data ?? []).filter(
    (project) => project.status === "active" && project.archived_at === null,
  );
  const loadedDays = (days.data?.days ?? []).map((day) => ({
    ...day,
    tasks: day.tasks.filter((task) => !isPendingDelete(pending, "task", task.id)),
  }));
  const entries = buildEntries(loadedDays, activeProjects, filters);
  const rings = routineTotals(loadedDays, filters);
  const split = splitEntries(entries);
  const loadedBars = linear
    ? [...split.bars, ...projectBars(projects.data ?? [], filters, range, today)]
    : [];
  const inboxTasks = (mode: typeof inboxMode) =>
    inboxPanelTasks(
      (openTasks.data ?? []).filter((task) => !isPendingDelete(pending, "task", task.id)),
      mode,
    );

  const colorOf = (lifeAreaId: number | null) =>
    lifeAreas.data?.find((area) => area.id === lifeAreaId)?.color ?? null;
  const onRoutine = (routine: RoutineDay, element: HTMLElement) =>
    setOpen({ kind: "routine", day: routine.day, routineId: routine.routineId, anchor: element });
  const context: RowContext = {
    today,
    colorOf,
    projects: projects.data ?? [],
    areaName: (id) => lifeAreas.data?.find((area) => area.id === id)?.title ?? null,
    onRoutine,
  };

  const daysKey = getDaysQueryKey(daysQuery);
  /** Shows a drag at once; the refetch after saving replaces it, and a failure undoes it. */
  const move = (
    entry: Entry,
    start: string,
    end: string,
    how: "move" | "resize",
    revert: () => void,
    startTime?: string | null,
    endTime?: string | null,
  ) => {
    setFailed(null);
    void queryClient.cancelQueries({ queryKey: daysKey });
    const before = queryClient.getQueryData<DaysRead>(daysKey);
    if (before)
      queryClient.setQueryData<DaysRead>(daysKey, {
        ...before,
        days: applyMove(before.days, entry, start, end, startTime, endTime),
      });
    const fail = () => {
      if (before) queryClient.setQueryData(daysKey, before);
      revert();
      setFailed("Couldn't move it. Try again.");
    };
    if (entry.kind === "task") {
      update.mutate(
        {
          path: { task_id: entry.task.id },
          body: {
            scheduled_date: start,
            ...(startTime !== undefined ? { scheduled_time: startTime } : {}),
            ...(endTime !== undefined ? { scheduled_end_time: endTime } : {}),
          },
        },
        {
          onSuccess: (change) =>
            change.batch_id &&
            showToast(
              `Scheduled “${entry.task.title}” · ${dayName(start, today)}`,
              change.batch_id,
            ),
          onError: fail,
        },
      );
    } else if (entry.kind === "project") {
      const { start_date } = entry.project;
      const dates =
        start_date && start_date > start
          ? { start_date: start, due_date: start }
          : { due_date: start };
      rescheduleProjectDates(
        entry.project,
        dates,
        `Set “${entry.project.title}” · Due ${shortDate(start)}`,
      );
    } else if (entry.kind === "event") {
      const { event } = entry;
      const dates =
        how === "resize"
          ? { start_date: start, end_date: end === start ? null : end }
          : shiftEvent(event, start);
      const handlers = {
        onSuccess: (change: EventChange) =>
          change.batch_id &&
          showToast(
            `${how === "resize" ? "Changed" : "Moved"} “${event.title}” · ${spanLabel(dates.start_date, dates.end_date ?? dates.start_date)}`,
            change.batch_id,
          ),
        onError: fail,
      };
      if (event.is_repeating) {
        if (before) queryClient.setQueryData(daysKey, before);
        setPendingEventMove({ event, dates, how, startTime, endTime, revert });
      } else {
        reschedule.mutate(
          {
            path: { event_id: event.event_id },
            body: {
              ...dates,
              ...(startTime !== undefined ? { start_time: startTime } : {}),
              ...(endTime !== undefined ? { end_time: endTime } : {}),
            },
          },
          handlers,
        );
      }
    } else if (entry.kind === "routine" && startTime !== undefined) {
      updateRoutine.mutate(
        {
          path: { routine_id: entry.routine.routineId },
          body: {
            start_time: startTime,
            end_time: endTime ?? null,
          },
        },
        {
          onError: fail,
        },
      );
    } else {
      revert();
    }
  };

  /** A task from the Inbox panel dropped on a day: Scheduled sets its date, Due its due date. */
  const dropFromInbox = (taskId: number, day: string, startTime?: string) => {
    setFailed(null);
    const task = openTasks.data?.find((item) => item.id === taskId);
    if (!task) return;
    const body =
      inboxMode === "scheduled"
        ? { scheduled_date: day, ...(startTime ? { scheduled_time: startTime } : {}) }
        : { due_date: day };
    update.mutate(
      { path: { task_id: taskId }, body },
      {
        onSuccess: (change) =>
          change.batch_id &&
          showToast(
            inboxMode === "scheduled"
              ? `Scheduled “${task.title}” · ${dayName(day, today)}`
              : `Set “${task.title}” · Due ${shortDate(day)}`,
            change.batch_id,
          ),
        onError: () => setFailed("Couldn't schedule it. Try again."),
      },
    );
  };

  const projectsKey = listProjectsOptions().queryKey;
  /** New dates for a project (its bar, or its due date's mark), shown at once like `move`. */
  const rescheduleProjectDates = (
    project: ProjectRead,
    dates: { start_date?: string; due_date: string },
    text: string,
  ) => {
    setFailed(null);
    void queryClient.cancelQueries({ queryKey: projectsKey });
    const before = queryClient.getQueryData<ProjectRead[]>(projectsKey);
    if (before)
      queryClient.setQueryData<ProjectRead[]>(
        projectsKey,
        before.map((item) => (item.id === project.id ? { ...item, ...dates } : item)),
      );
    rescheduleProject.mutate(
      { path: { project_id: project.id }, body: dates },
      {
        onSuccess: (change) => change.batch_id && showToast(text, change.batch_id),
        onError: () => {
          if (before) queryClient.setQueryData(projectsKey, before);
          setFailed("Couldn't move it. Try again.");
        },
      },
    );
  };

  /** Quarter and Year: a bar, a day popover's item or an Inbox task let go over a day. */
  const dropLinear = (subject: DragSubject, span: DaySpan) => {
    if (!changesDates(subject, span)) return;
    if (subject.kind === "inbox") return dropFromInbox(subject.task.id, span.start);
    const dates = projectDates(subject, span);
    if (subject.kind === "entry") {
      const { entry } = subject;
      if (entry.kind === "project" && dates)
        return rescheduleProjectDates(
          entry.project,
          dates,
          `Set “${entry.project.title}” · Due ${shortDate(dates.due_date)}`,
        );
      return move(entry, span.start, span.start, "move", () => {});
    }
    const { bar, how } = subject;
    const verb = how === "move" ? "Moved" : "Changed";
    if (bar.kind === "project" && dates)
      return rescheduleProjectDates(
        bar.project,
        dates,
        `${verb} “${bar.project.title}” · ${spanLabel(span.start, span.end)}`,
      );
    if (bar.kind === "event")
      move(bar.entry, span.start, span.end, how === "move" ? "move" : "resize", () => {});
  };
  const { drag, begin } = useLinearDrag(dropLinear);
  const bars = withPreview(loadedBars, drag?.subject ?? null, drag?.span ?? null);

  const error = days.error ?? lifeAreas.error ?? projects.error ?? openTasks.error;
  const ready = days.data && lifeAreas.data && projects.data;
  const close = () => setOpen(null);
  const newTaskOn = (day: string, startTime?: string, endTime?: string) => {
    close();
    openNewTask(
      {
        scheduledDate: day,
        ...(startTime ? { scheduledTime: startTime } : {}),
        ...(endTime ? { scheduledEndTime: endTime } : {}),
      },
      today,
    );
  };
  const newEventOn = (day: string, startTime?: string, endTime?: string) => {
    close();
    openNewEvent(
      {
        day,
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
      },
      today,
    );
  };
  const nothingYet =
    anyEvents.data?.length === 0 && anyTasks.data?.length === 0 && entries.length === 0;

  const popover = (() => {
    if (!open || !ready) return null;
    if (open.kind === "hidden") {
      return (
        <AnchoredPopover
          anchor={open.anchor}
          label={`More bars in ${monthName(`${open.row.month}-01`)}`}
          width={300}
          onClose={close}
        >
          <HiddenBarsPopover
            month={monthName(`${open.row.month}-01`)}
            bars={open.row.hidden}
            context={context}
            onClose={close}
          />
        </AnchoredPopover>
      );
    }
    if (open.kind === "add") {
      return (
        addAnchor && (
          <AnchoredPopover
            anchor={addAnchor}
            label={`Add on ${open.day}`}
            width={180}
            onClose={close}
          >
            <AddMenu
              day={open.day}
              onEvent={() => newEventOn(open.day, open.startTime, open.endTime)}
              onTask={() => newTaskOn(open.day, open.startTime, open.endTime)}
            />
          </AnchoredPopover>
        )
      );
    }
    if (open.kind === "entry") {
      const openEntryPanel = () => {
        const { entry } = open;
        close();
        if (entry.kind === "event") {
          openPanel({
            kind: "event",
            id: entry.event.event_id,
            day: entry.event.is_repeating ? entry.event.occurrence_date : null,
          });
        } else if (entry.kind === "task") {
          openPanel({ kind: "task", id: entry.task.id });
        } else if (entry.kind === "project") {
          openPanel({ kind: "project", id: entry.project.id });
        } else if (entry.kind === "routine") {
          openPanel({ kind: "routine", id: entry.routine.routineId });
        }
      };
      const currentEntry = entries.find((item) => item.key === open.entry.key) ?? open.entry;
      return (
        <AnchoredPopover anchor={open.anchor} label="Item details" width={280} onClose={close}>
          <EntryPreviewPopover
            entry={currentEntry}
            context={context}
            onOpenPanel={openEntryPanel}
            onClose={close}
          />
        </AnchoredPopover>
      );
    }
    if (open.kind === "routine") {
      const routines = (rings.get(open.day)?.routines ?? []).filter(
        (routine) => open.routineId === null || routine.routineId === open.routineId,
      );
      if (routines.length === 0) return null;
      return (
        <AnchoredPopover anchor={open.anchor} label="Routine" width={300} onClose={close}>
          <RoutinePopover routines={routines} today={today} colorOf={colorOf} onClose={close} />
        </AnchoredPopover>
      );
    }
    const dayEntries = entries
      .filter((entry) => entry.start <= open.day && open.day <= entry.end)
      .sort((a, b) => Number(b.kind === "event") - Number(a.kind === "event") || a.order - b.order);
    return (
      <AnchoredPopover
        anchor={open.anchor}
        label={`Everything on ${open.day}`}
        width={320}
        placement={linear ? "right top" : "bottom"}
        onClose={close}
      >
        <DayPopover
          day={open.day}
          entries={dayEntries}
          context={context}
          onAdd={() => newTaskOn(open.day)}
          onClose={close}
          onDragStart={
            linear ? (entry, event) => begin({ kind: "entry", entry }, event, close) : undefined
          }
        />
      </AnchoredPopover>
    );
  })();

  const inboxScheduled = openTasks.data ? inboxTasks("scheduled").length : undefined;

  return (
    <>
      <CalendarSidebar lifeAreas={areas} inboxCount={inboxScheduled} view={view} />
      <main aria-label="Calendar" className="flex min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <CalendarHeader anchor={anchor} today={today} />
          {failed && (
            <p role="alert" className="px-6 pb-2 type-meta text-(--text-danger)">
              {failed}
            </p>
          )}
          <div className={`relative min-h-0 flex-1 pb-6 pl-6 ${panel ? "pr-3" : "pr-6"}`}>
            {ready && !error && nothingYet && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                <p className="type-body text-(--text-secondary)">No events or tasks yet.</p>
                <Button
                  className="pointer-events-auto"
                  onPress={() => openNewEvent({ day: anchor }, today)}
                >
                  <Plus aria-hidden strokeWidth={2} />
                  New event
                </Button>
              </div>
            )}
            {error ? (
              <QueryError error={error} />
            ) : !ready ? (
              <p className="type-meta text-(--text-tertiary)">Loading…</p>
            ) : linear ? (
              <LinearCalendar
                view={view}
                range={range}
                today={today}
                bars={bars}
                marks={split.marks}
                weekends={filters.show.weekends}
                colorOf={colorOf}
                openDay={open?.kind === "day" ? open.day : null}
                onDay={(day, element) => setOpen({ kind: "day", day, anchor: element })}
                onHidden={(row, element) => setOpen({ kind: "hidden", row, anchor: element })}
                drag={drag}
                onDragStart={(subject, event) => begin(subject, event, close)}
              />
            ) : (
              <CalendarGrid
                view={view}
                dayCount={dayCount}
                timed={timed}
                range={range}
                month={anchor.slice(0, 7)}
                today={today}
                entries={
                  view === "month" ? entries.filter((entry) => entry.kind !== "routine") : entries
                }
                weekends={filters.show.weekends}
                onInspect={(entry, anchorEl) => setOpen({ kind: "entry", entry, anchor: anchorEl })}
                rings={view === "month" ? rings : new Map()}
                colorOf={colorOf}
                onRoutine={onRoutine}
                onRing={(day, element) =>
                  setOpen({ kind: "routine", day, routineId: null, anchor: element })
                }
                onMore={(day, element) => setOpen({ kind: "day", day, anchor: element })}
                onDayClick={(day, point) => setOpen({ kind: "add", day, ...point })}
                onTimeSelect={(day, startTime, endTime, point) =>
                  setOpen({ kind: "add", day, startTime, endTime, ...point })
                }
                onMove={move}
                onDrop={dropFromInbox}
              />
            )}
          </div>
        </div>
        {ready && panel === "agenda" && (
          <AgendaPanel
            days={agendaDays(entries, range)}
            context={context}
            rangeKey={`${view}:${range.start}`}
            monthHeadings={linear}
            emptyText={
              isFiltered(filters, view) ? "Nothing matches the filters." : "Nothing scheduled."
            }
            onClearFilters={
              isFiltered(filters, view)
                ? () =>
                    setFilters({
                      ...DEFAULT_FILTERS,
                      show: {
                        ...DEFAULT_FILTERS.show,
                        cancelled: filters.show.cancelled,
                        weekends: filters.show.weekends,
                      },
                    })
                : undefined
            }
          />
        )}
        {ready && panel === "inbox" && (
          <InboxPanel
            tasks={inboxTasks(inboxMode)}
            mode={inboxMode}
            context={context}
            onMode={setInboxMode}
            onDragStart={
              linear ? (task, event) => begin({ kind: "inbox", task }, event) : undefined
            }
          />
        )}
      </main>
      {open?.kind === "add" && (
        <span
          ref={setAddAnchor}
          aria-hidden
          className="pointer-events-none fixed size-px"
          style={{ left: open.x, top: open.y }}
        />
      )}
      {popover}
      {pendingEventMove && (
        <EventScopeDialog
          title={pendingEventMove.event.title}
          onCancel={() => {
            pendingEventMove.revert();
            setPendingEventMove(null);
          }}
          onConfirm={(scope: EventEditScope) => {
            const { event, dates, how, startTime, endTime, revert } = pendingEventMove;
            setPendingEventMove(null);
            const datesChanged =
              dates.start_date !== event.start_date ||
              (dates.end_date ?? dates.start_date) !== event.end_date;
            editOccurrence.mutate(
              {
                path: { event_id: event.event_id, day: event.occurrence_date },
                body: {
                  scope,
                  ...(datesChanged
                    ? {
                        start_date: dates.start_date,
                        end_date: dates.end_date ?? dates.start_date,
                      }
                    : {}),
                  ...(startTime !== undefined ? { start_time: startTime } : {}),
                  ...(endTime !== undefined ? { end_time: endTime } : {}),
                },
              },
              {
                onSuccess: (change: EventChange) =>
                  change.batch_id &&
                  showToast(
                    `${how === "resize" ? "Changed" : "Moved"} “${event.title}” · ${spanLabel(dates.start_date, dates.end_date ?? dates.start_date)}`,
                    change.batch_id,
                  ),
                onError: () => {
                  revert();
                  setFailed("Couldn't move it. Try again.");
                },
              },
            );
          }}
        />
      )}
      <DragOverlay drag={drag} />
    </>
  );
}
