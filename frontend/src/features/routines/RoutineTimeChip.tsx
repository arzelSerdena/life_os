import { TimeRangeChip } from "../pickers/TimeRangeChip";

/**
 * Optional start/end time chip for routines (NewRoutineModal and RoutineHeader).
 * Setting a time places the routine on timed calendar views.
 */
export function RoutineTimeChip({
  startTime,
  endTime,
  onChange,
}: {
  startTime: string | null;
  endTime: string | null;
  onChange: (next: { startTime: string | null; endTime: string | null }) => void;
}) {
  return (
    <TimeRangeChip
      label="Routine time"
      startTime={startTime}
      endTime={endTime}
      onChange={onChange}
    />
  );
}
