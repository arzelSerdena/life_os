import { Alert, Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { createMetricEntryMutation } from "../../client/@tanstack/react-query.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import { today } from "../../period";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDiscardGuard } from "../confirming/useDiscardGuard";
import { DatePickerField } from "../pickers/DatePicker";
import { formatValue, inputAffixes, type MetricFormat, parseValue } from "./format";

export type LoggableMetric = {
  id: number;
  title: string;
  format: MetricFormat;
  unit: string | null;
};

const FIELD_LABEL = "text-xs leading-4 font-semibold text-(--text-primary)";
const FIELD =
  "h-8 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 text-[13px] text-(--text-primary) outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-200";

/**
 * Logs one entry on a manual metric: value, date (up to today), and an optional note.
 * Reports the logged value in the change toast with Undo.
 */
export function LogMetricModal({
  metric,
  onClose,
}: {
  metric: LoggableMetric;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(() => today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const initialDate = useRef(date);
  const guard = useDiscardGuard(
    text.trim() !== "" || note.trim() !== "" || date !== initialDate.current,
    onClose,
  );
  const showToast = useChangeToast((state) => state.show);
  const log = useMutation(createMetricEntryMutation());

  const value = parseValue(text, metric.format);
  const { prefix, suffix } = inputAffixes(metric);
  const maxDay = today();
  const missing =
    value === null
      ? "Enter a number"
      : !date
        ? "Pick a date"
        : date > maxDay
          ? "Pick today or an earlier date"
          : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (missing || value === null || log.isPending) return;
    setError(null);
    try {
      const change = await log.mutateAsync({
        path: { metric_id: metric.id },
        body: {
          value,
          date,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      showToast(`Logged ${formatValue(value, metric)} · ${metric.title}`, change.batch_id);
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <>
      <Modal.Backdrop {...guard.backdropProps}>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-[420px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
            <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
              <Modal.Heading className="truncate type-panel-title text-(--text-primary)">
                Log {metric.title}
              </Modal.Heading>
              <IconButton label="Close" size="md" onPress={onClose}>
                <X />
              </IconButton>
            </Modal.Header>
            <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
              <Modal.Body className="m-0 flex flex-col gap-4 px-5 py-4">
                <div className="flex gap-3">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label htmlFor="log-metric-value" className={FIELD_LABEL}>
                      Value
                    </label>
                    <span
                      className={`${FIELD} flex items-center gap-1 has-[:focus-visible]:border-brand-600 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-200`}
                    >
                      {prefix && <span className="text-(--text-tertiary)">{prefix}</span>}
                      <input
                        id="log-metric-value"
                        aria-label="Value"
                        autoFocus
                        inputMode={metric.format === "duration" ? "text" : "decimal"}
                        placeholder={metric.format === "duration" ? "1:30" : undefined}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full min-w-0 bg-transparent tabular-nums outline-none"
                      />
                      {suffix && <span className="shrink-0 text-(--text-tertiary)">{suffix}</span>}
                    </span>
                  </div>
                  <div className="flex w-[160px] flex-col gap-1.5">
                    <span className={FIELD_LABEL}>Date</span>
                    <DatePickerField label="Date" value={date} onChange={setDate} />
                  </div>
                </div>
                <TextField value={note} onChange={setNote} className="gap-1.5">
                  <Label className={FIELD_LABEL}>Note</Label>
                  <Input maxLength={500} placeholder="Optional note" className="h-8 type-body" />
                </TextField>
                {error && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>{error}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}
              </Modal.Body>
              <Modal.Footer className="m-0 flex justify-end gap-2 border-t border-(--border-default) px-5 py-3">
                <Button
                  variant="secondary"
                  onPress={onClose}
                  className="border border-(--button-secondary-border) bg-(--bg-surface) text-(--button-secondary-text)"
                >
                  Cancel
                </Button>
                <Button type="submit" isPending={log.isPending} isDisabled={missing !== null}>
                  Log entry
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {guard.dialog}
    </>
  );
}
