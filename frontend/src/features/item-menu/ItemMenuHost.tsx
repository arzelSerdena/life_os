import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  getEventOptions,
  getLifeAreaOptions,
  getMetricOptions,
  getProjectOptions,
  getRoutinePageOptions,
  getTaskOptions,
  getTaskTemplateOptions,
} from "../../client/@tanstack/react-query.gen";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { usePeriodStore } from "../../stores/periodStore";
import {
  type ItemActions,
  useAreaActions,
  useEventActions,
  useMetricActions,
  useProjectActions,
  useTaskActions,
  useTemplateActions,
} from "./entityActions";
import { isNativeMenuTarget, type MenuPoint, menuPoint, PointMenu } from "./PointMenu";
import { useRoutineActions, useStepActions } from "./routineActions";
import { decodeItem, ITEM_MENU_ATTRIBUTE, type ItemTarget, itemPagePath } from "./target";

/**
 * The item under a right-click: the closest element marked with `itemMenuProps`, or, for a
 * control inside a row or card (its checkbox), the row's stretched title link, whose
 * clickable area fills the row.
 */
export function findItem(element: Element): { target: ItemTarget; element: Element } | null {
  const marked = element.closest(`[${ITEM_MENU_ATTRIBUTE}]`);
  if (marked) {
    const target = decodeItem(marked.getAttribute(ITEM_MENU_ATTRIBUTE));
    return target && { target, element: marked };
  }
  for (let node: Element | null = element; node && node !== document.body; ) {
    const covering = [
      ...node.querySelectorAll<HTMLElement>(`[${ITEM_MENU_ATTRIBUTE}][data-stretched]`),
    ].filter((link) => link.offsetParent === node);
    if (covering.length === 1) {
      const target = decodeItem(covering[0].getAttribute(ITEM_MENU_ATTRIBUTE));
      return target && { target, element: covering[0] };
    }
    node = node.parentElement;
  }
  return null;
}

type Opened = { key: number; target: ItemTarget; point: MenuPoint | null };

/**
 * Right-click on any row, card, bar or heatmap square opens that item's ⋯ menu at the
 * pointer (Shift F10 and the menu key open it under the focused item). Text fields and
 * unmarked places keep the browser's menu. A row that holds its own ⋯ actions handles the
 * event itself first.
 */
export function ItemMenuHost() {
  const [opened, setOpened] = useState<Opened | null>(null);
  const nextKey = useRef(0);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const element = event.target as Element | null;
      if (event.defaultPrevented || !element) return;
      // Pop-ups render outside #root; their own right-clicks are left alone.
      if (!document.getElementById("root")?.contains(element)) return;
      if (isNativeMenuTarget(element)) return;
      const found = findItem(element);
      if (!found) return;
      event.preventDefault();
      nextKey.current += 1;
      setOpened({
        key: nextKey.current,
        target: found.target,
        point: menuPoint(event, found.element),
      });
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  if (!opened) return null;
  // The item stays mounted after its menu closes, so a dialog its action opened can finish.
  return (
    <ItemMenu
      key={opened.key}
      target={opened.target}
      point={opened.point}
      onClose={() => setOpened((current) => current && { ...current, point: null })}
    />
  );
}

type MenuProps = { point: MenuPoint | null; onClose: () => void; leave: (to: string) => void };

function ItemMenu({
  target,
  point,
  onClose,
}: {
  target: ItemTarget;
  point: MenuPoint | null;
  onClose: () => void;
}) {
  const leave = useLeave(target);
  const props = { point, onClose, leave };
  switch (target.kind) {
    case "area":
      return <AreaMenu id={target.id} {...props} />;
    case "project":
      return <ProjectMenu id={target.id} {...props} />;
    case "task":
      return <TaskMenu id={target.id} {...props} />;
    case "template":
      return <TemplateMenu id={target.id} {...props} />;
    case "event":
      return <EventMenu id={target.id} day={target.day} {...props} />;
    case "metric":
      return <MetricMenu id={target.id} {...props} />;
    case "routine":
      return <RoutineMenu id={target.id} {...props} />;
    case "step":
      return <StepMenu id={target.id} routineId={target.routineId} {...props} />;
  }
}

/**
 * After the item is archived, deleted or restored: close the panel if it shows the item, and
 * leave the item's own page for `to` if that's where we are.
 */
function useLeave(target: ItemTarget) {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const current = useRef(pathname);
  current.current = pathname;
  return (to: string) => {
    const panel = useDetailPanel.getState();
    if (panel.target?.kind === target.kind && panel.target.id === target.id) panel.close();
    if (current.current === itemPagePath(target)) navigate(to, { replace: true });
  };
}

/** The menu once the item has loaded, then the dialogs its actions open. */
function Shown({
  menu,
  title,
  point,
  onClose,
}: {
  menu: ItemActions;
  title: string | undefined;
  point: MenuPoint | null;
  onClose: () => void;
}) {
  const fail = useChangeToast((state) => state.fail);
  useEffect(() => {
    if (menu.error) fail("Couldn't make that change.", menu.error);
  }, [menu.error, fail]);
  return (
    <>
      {point && title !== undefined && menu.actions.length > 0 && (
        <PointMenu
          point={point}
          actions={menu.actions}
          label={`More actions for “${title}”`}
          onClose={onClose}
        />
      )}
      {menu.dialogs}
    </>
  );
}

function AreaMenu({ id, leave, ...rest }: { id: number } & MenuProps) {
  const area = useQuery(getLifeAreaOptions({ path: { life_area_id: id } })).data;
  const menu = useAreaActions(area, {
    withEdit: true,
    onArchived: () => leave("/areas"),
    onDeleted: () => leave("/areas"),
    onRestored: () => leave("/areas"),
  });
  return <Shown menu={menu} title={area?.title} {...rest} />;
}

function ProjectMenu({ id, leave, ...rest }: { id: number } & MenuProps) {
  const project = useQuery(getProjectOptions({ path: { project_id: id } })).data;
  const menu = useProjectActions(project, {
    withEdit: true,
    onDeleted: () => leave(`/areas/${project?.life_area_id ?? ""}`),
  });
  return <Shown menu={menu} title={project?.title} {...rest} />;
}

function TaskMenu({ id, leave, ...rest }: { id: number } & MenuProps) {
  const task = useQuery(getTaskOptions({ path: { task_id: id } })).data;
  const menu = useTaskActions(task, { onDeleted: () => leave("") });
  return <Shown menu={menu} title={task?.title} {...rest} />;
}

function TemplateMenu({ id, leave, ...rest }: { id: number } & MenuProps) {
  const template = useQuery(getTaskTemplateOptions({ path: { template_id: id } })).data;
  const menu = useTemplateActions(template, { onDeleted: () => leave("") });
  return <Shown menu={menu} title={template?.title} {...rest} />;
}

function EventMenu({ id, day, leave, ...rest }: { id: number; day: string | null } & MenuProps) {
  const event = useQuery(getEventOptions({ path: { event_id: id } })).data;
  const menu = useEventActions(event, day, { onDeleted: () => leave("") });
  return <Shown menu={menu} title={event?.title} {...rest} />;
}

function MetricMenu({ id, leave, ...rest }: { id: number } & MenuProps) {
  const metric = useQuery(getMetricOptions({ path: { metric_id: id } })).data;
  const menu = useMetricActions(metric, {
    onArchived: () => leave(""),
    onDeleted: () => leave(""),
  });
  return <Shown menu={menu} title={metric?.title} {...rest} />;
}

/** Routines and steps read the routine page (cached when it's the page on screen). */
function useRoutinePage(routineId: number) {
  const { period, date } = usePeriodStore();
  return useQuery(
    getRoutinePageOptions({ path: { routine_id: routineId }, query: { period, date } }),
  ).data;
}

function RoutineMenu({ id, leave, ...rest }: { id: number } & MenuProps) {
  const page = useRoutinePage(id);
  const menu = useRoutineActions(page, { onDeleted: () => leave("/areas") });
  return <Shown menu={menu} title={page?.routine.title} {...rest} />;
}

function StepMenu({
  id,
  routineId,
  leave: _leave,
  ...rest
}: { id: number; routineId: number } & MenuProps) {
  const row = useRoutinePage(routineId)?.steps.find((item) => item.step.id === id);
  const menu = useStepActions(row);
  return <Shown menu={menu} title={row?.step.title} {...rest} />;
}
