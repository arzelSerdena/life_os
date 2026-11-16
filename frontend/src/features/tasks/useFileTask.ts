import { useMutation } from "@tanstack/react-query";
import { moveTaskMutation, updateTaskMutation } from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, ProjectRead, TaskChange, TaskRead } from "../../client/types.gen";
import { useChangeToast } from "../../stores/changeToastStore";
import { shortDate } from "../life-areas/overview/format";
import { PRIORITIES } from "./board";
import { addDays, type FileTarget } from "./inbox";

type Context = {
  today: string;
  lifeAreas: readonly LifeAreaRead[];
  projects: readonly ProjectRead[];
};

/** "Today", "Tomorrow" or "Nov 18". */
export function dayName(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return shortDate(date);
}

/**
 * Files a task: into an area or a project (a move), onto a scheduled date or a priority (an
 * edit). Each is one undoable change, reported in the undo toast (Moved “X” · Career).
 */
export function useFileTask(context: Context) {
  const showToast = useChangeToast((state) => state.show);
  const move = useMutation(moveTaskMutation());
  const update = useMutation(updateTaskMutation());

  const file = (task: TaskRead, target: FileTarget) => {
    const report = (verb: string, effect: string) => (change: TaskChange) => {
      if (change.batch_id) showToast(`${verb} “${task.title}” · ${effect}`, change.batch_id);
    };
    const path = { task_id: task.id };
    switch (target.kind) {
      case "area": {
        const area = context.lifeAreas.find((item) => item.id === target.id);
        move.mutate(
          { path, body: { life_area_id: target.id } },
          { onSuccess: report("Moved", area?.title ?? "area") },
        );
        return;
      }
      case "project": {
        const project = context.projects.find((item) => item.id === target.id);
        move.mutate(
          { path, body: { project_id: target.id } },
          { onSuccess: report("Moved", project?.title ?? "project") },
        );
        return;
      }
      case "date":
        update.mutate(
          { path, body: { scheduled_date: target.date } },
          { onSuccess: report("Scheduled", dayName(target.date, context.today)) },
        );
        return;
      case "priority": {
        const label = PRIORITIES.find((item) => item.key === target.priority)?.label ?? "";
        update.mutate(
          { path, body: { priority: target.priority } },
          { onSuccess: report("Set", target.priority === "none" ? label : `${label} priority`) },
        );
        return;
      }
    }
  };

  return { file, error: move.error ?? update.error };
}
