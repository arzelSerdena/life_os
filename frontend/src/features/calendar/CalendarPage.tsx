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
  updateTaskMutation,
} from "../../client/@tanstack/react-query.gen";
import type { DaysRead, EventChange } from "../../client/types.gen";
import { AnchoredPopover } from "../../components/AnchoredPopover";
import { QueryError } from "../../components/QueryError";
import { today as localToday } from "../../period";
import { useCalendarStore } from "../../stores/calendarStore";
import { useChangeToast } from "../../stores/changeToastStore";
import { useNewEvent } from "../../stores/newEventStore";
import { useNewTask } from "../../stores/newTaskStore";
import { isPendingDelete, usePendingDeletes } from "../../stores/pendingDeleteStore";
import { shortDate } from "../life-areas/overview/format";
import { usePageSpot } from "../tasks/newTaskShortcut";
import type { RoutineDay } from "../tasks/next7";
import { dayName } from "../tasks/useFileTask";
import type { RowContext } from "./AgendaRow";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarHeader } from "./CalendarHeader";
import { AgendaPanel, InboxPanel } from "./CalendarPanel";
import { AddMenu, DayPopover, RoutinePopover } from "./CalendarPopovers";
import { CalendarSidebar } from "./CalendarSidebar";
import {
  agendaDays,
  applyMove,
  buildEntries,
  DEFAULT_FILTERS,
  type Entry,
  inboxPanelTasks,
  isFiltered,
  routineTotals,
  shiftEvent,
  spanLabel,
  viewRange,
} from "./calendar";

/** What is open over the grid: a day's routines, "+3 more", or the add menu of a day. */
type Open =
  | { kind: "routine"; day: string; routineId: number | null; anchor: HTMLElement }
  | { kind: "day"; day: string; anchor: HTMLElement }
  | { kind: "add"; day: string; x: number; y: number };

/**
 * The Calendar (Approved: Calendar): the sidebar's filters, the Week or Month day grid, and
 * the Agenda or Inbox on the right. Loading the range rolls unfinished tasks over to today
 * and creates its recurring tasks, as the Tasks boards do.
 */
export function CalendarPage() {
  const queryClient = useQueryClient();
  const {
    view,
    anchor: chosen,
    panel,
    setPanel,
    inboxMode,
    setInboxMode,
    filters,
    setFilters,
  } = useCalendarStore();
  const showToast = useChangeToast((state) => state.show);
  const openNewTask = useNewTask((state) => state.open);
  const openNewEvent = useNewEvent((state) => state.open);
  const pending = usePendingDeletes((state) => state.pending);
  const [open, setOpen] = useState<Open | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // The add menu anchors to a point: a 1 px mark where the day was clicked.
  const [addAnchor, setAddAnchor] = useState<HTMLSpanElement | null>(null);

  // Until the server says which day it is (Settings › Day ends at), the computer's date.
  const [serverToday, setServerToday] = useState<string | null>(null);
  const today = serverToday ?? localToday();
  const anchor = chosen ?? today;
  const range = viewRange(view, anchor);
  const daysQuery = {
    query: { start: range.start, count: range.count, include_cancelled: filters.show.cancelled },
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

  const update = useMutation(updateTaskMutation());
  const reschedule = useMutation(rescheduleEventMutation());
  const editOccurrence = useMutation(editEventOccurrenceMutation());

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
  ) => {
    setFailed(null);
    void queryClient.cancelQueries({ queryKey: daysKey });
    const before = queryClient.getQueryData<DaysRead>(daysKey);
    if (before)
      queryClient.setQueryData<DaysRead>(daysKey, {
        ...before,
        days: applyMove(before.days, entry, start, end),
      });
    const fail = () => {
      if (before) queryClient.setQueryData(daysKey, before);
      revert();
      setFailed("Couldn't move it. Try again.");
    };
    if (entry.kind === "task") {
      update.mutate(
        { path: { task_id: entry.task.id }, body: { scheduled_date: start } },
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
    } else if (entry.kind === "event") {
      const { event } = entry;
      const dates =
        event.start_date === start
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
      if (event.is_repeating)
        // Only this occurrence moves ("this one"). Its end date is always sent, so an
        // occurrence resized to one day doesn't keep the series' length.
        editOccurrence.mutate(
          {
            path: { event_id: event.event_id, day: event.occurrence_date },
            body: {
              scope: "this",
              start_date: dates.start_date,
              end_date: dates.end_date ?? dates.start_date,
            },
          },
          handlers,
        );
      else reschedule.mutate({ path: { event_id: event.event_id }, body: dates }, handlers);
    } else {
      revert();
    }
  };

  /** A task from the Inbox panel dropped on a day: Scheduled sets its date, Due its due date. */
  const dropFromInbox = (taskId: number, day: string) => {
    setFailed(null);
    const task = openTasks.data?.find((item) => item.id === taskId);
    if (!task) return;
    const body = inboxMode === "scheduled" ? { scheduled_date: day } : { due_date: day };
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

  const error = days.error ?? lifeAreas.error ?? projects.error ?? openTasks.error;
  const ready = days.data && lifeAreas.data && projects.data;
  const close = () => setOpen(null);
  const newTaskOn = (day: string) => {
    close();
    openNewTask({ scheduledDate: day }, today);
  };
  const newEventOn = (day: string) => {
    close();
    openNewEvent({ day }, today);
  };
  const nothingYet =
    anyEvents.data?.length === 0 && anyTasks.data?.length === 0 && entries.length === 0;

  const popover = (() => {
    if (!open || !ready) return null;
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
              onEvent={() => newEventOn(open.day)}
              onTask={() => newTaskOn(open.day)}
            />
          </AnchoredPopover>
        )
      );
    }
    if (open.kind === "routine") {
      const routines = (rings.get(open.day)?.routines ?? []).filter(
        (routine) => open.routineId === null || routine.routineId === open.routineId,
      );
      if (routines.length === 0) return null;
      return (
        <AnchoredPopover anchor={open.anchor} label="Routine" width={300} onClose={close}>
          <RoutinePopover routines={routines} today={today} colorOf={colorOf} />
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
        placement="bottom"
        onClose={close}
      >
        <DayPopover
          day={open.day}
          entries={dayEntries}
          context={context}
          onAdd={() => newTaskOn(open.day)}
          onClose={close}
        />
      </AnchoredPopover>
    );
  })();

  const inboxScheduled = openTasks.data ? inboxTasks("scheduled").length : undefined;

  return (
    <>
      <CalendarSidebar lifeAreas={areas} inboxCount={inboxScheduled} />
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
            ) : (
              <CalendarGrid
                view={view}
                range={range}
                month={anchor.slice(0, 7)}
                today={today}
                entries={
                  view === "month" ? entries.filter((entry) => entry.kind !== "routine") : entries
                }
                weekends={filters.show.weekends}
                rings={view === "month" ? rings : new Map()}
                colorOf={colorOf}
                onRoutine={onRoutine}
                onRing={(day, element) =>
                  setOpen({ kind: "routine", day, routineId: null, anchor: element })
                }
                onMore={(day, element) => setOpen({ kind: "day", day, anchor: element })}
                onDayClick={(day, point) => setOpen({ kind: "add", day, ...point })}
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
            emptyText={isFiltered(filters) ? "Nothing matches the filters." : "Nothing scheduled."}
            onClearFilters={
              isFiltered(filters)
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
            onHide={() => setPanel(null)}
          />
        )}
        {ready && panel === "inbox" && (
          <InboxPanel
            tasks={inboxTasks(inboxMode)}
            mode={inboxMode}
            context={context}
            onMode={setInboxMode}
            onHide={() => setPanel(null)}
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
    </>
  );
}
