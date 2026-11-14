import { Alert, Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  createMetricMutation,
  createMetricTargetMutation,
} from "../../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, MetricCreate, TargetCreate } from "../../../client/types.gen";
import { IconButton } from "../../../components/IconButton";
import { errorMessage } from "../../../errors";
import { periodRange, today } from "../../../period";
import { areaDataAttribute } from "../palette";

type TargetKind = "none" | "per_period" | "reach_by";

/** Create a metric owned by this area, with an optional target. */
export function NewMetricModal({
  lifeArea,
  onClose,
}: {
  lifeArea: LifeAreaRead;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [aggregation, setAggregation] = useState<MetricCreate["aggregation"]>("sum");
  const [direction, setDirection] = useState<"higher" | "lower">("higher");
  const [kind, setKind] = useState<TargetKind>("none");
  const [value, setValue] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");
  const [startDate, setStartDate] = useState(() => periodRange("month", today()).start);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createMetric = useMutation(createMetricMutation());
  const createTarget = useMutation(createMetricTargetMutation());
  const busy = createMetric.isPending || createTarget.isPending;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    const amount = Number(value);
    if (!name) return setError("Enter a name.");
    if (kind !== "none" && !(value.trim() && Number.isFinite(amount)))
      return setError("Enter a target number.");
    if (kind === "reach_by" && !endDate) return setError("Pick the date to reach it by.");
    setError(null);
    try {
      const metric = await createMetric.mutateAsync({
        body: {
          title: name,
          unit: unit.trim() || null,
          aggregation,
          direction,
          life_area_id: lifeArea.id,
        },
      });
      if (kind !== "none") {
        const body: TargetCreate =
          kind === "per_period"
            ? { kind, target_value: amount, period, start_date: startDate }
            : { kind, target_value: amount, start_date: today(), end_date: endDate };
        await createTarget.mutateAsync({ path: { metric_id: metric.id }, body });
      }
      await queryClient.invalidateQueries();
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      className="bg-[rgb(17_24_39/0.32)]"
    >
      <Modal.Container>
        <Modal.Dialog className="w-[520px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
          <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
            <Modal.Heading className="type-panel-title text-(--text-primary)">
              New metric
            </Modal.Heading>
            <IconButton label="Close" size="md" onPress={onClose}>
              <X />
            </IconButton>
          </Modal.Header>
          <form noValidate onSubmit={submit}>
            <Modal.Body className="m-0 flex flex-col gap-4 px-5 py-4">
              <p className="flex items-center gap-2 type-meta text-(--text-tertiary)">
                <span
                  data-area={areaDataAttribute(lifeArea.color)}
                  className="flex h-5 items-center gap-1 rounded-full bg-(--area-tint-active) px-2 text-[11px] font-medium text-(--area-text)"
                >
                  <span aria-hidden className="size-1.5 rounded-full bg-(--area-solid)" />
                  {lifeArea.title}
                </span>
                Owned by {lifeArea.title}
              </p>
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <TextField autoFocus value={title} onChange={setTitle} className="gap-1.5">
                  <Label className={FIELD_LABEL}>Name</Label>
                  <Input className="h-8 type-body" />
                </TextField>
                <TextField value={unit} onChange={setUnit} className="gap-1.5">
                  <Label className={FIELD_LABEL}>
                    Unit <span className="font-normal text-(--text-tertiary)">optional</span>
                  </Label>
                  <Input placeholder="e.g. km, h, ₱" className="h-8 type-body" />
                </TextField>
              </div>
              <div className="grid grid-cols-[1fr_150px] gap-3">
                <Choice
                  label="Combine entries by"
                  value={aggregation}
                  onChange={setAggregation}
                  options={[
                    ["sum", "Sum"],
                    ["average", "Average"],
                    ["latest", "Latest"],
                  ]}
                />
                <Choice
                  label="Better when"
                  value={direction}
                  onChange={setDirection}
                  options={[
                    ["higher", "Higher"],
                    ["lower", "Lower"],
                  ]}
                />
              </div>
              <fieldset className="flex flex-col gap-3 rounded-(--radius-8) border border-(--border-default) p-3">
                <legend className={`${FIELD_LABEL} px-1`}>
                  Target <span className="font-normal text-(--text-tertiary)">optional</span>
                </legend>
                <Choice
                  label="Target"
                  hideLabel
                  value={kind}
                  onChange={setKind}
                  options={[
                    ["none", "No target"],
                    ["per_period", "Every period"],
                    ["reach_by", "Reach by a date"],
                  ]}
                />
                {kind !== "none" && (
                  <div className="flex flex-wrap items-center gap-2 type-body text-(--text-secondary)">
                    <input
                      aria-label="Target number"
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className={`${FIELD} w-20`}
                    />
                    {kind === "per_period" ? (
                      <>
                        per
                        <select
                          aria-label="Period"
                          value={period}
                          onChange={(e) => setPeriod(e.target.value as typeof period)}
                          className={FIELD}
                        >
                          <option value="day">day</option>
                          <option value="week">week</option>
                          <option value="month">month</option>
                        </select>
                        starting
                        <input
                          type="date"
                          aria-label="Starting"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className={FIELD}
                        />
                      </>
                    ) : (
                      <>
                        by
                        <input
                          type="date"
                          aria-label="Reach by"
                          value={endDate}
                          min={today()}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={FIELD}
                        />
                      </>
                    )}
                  </div>
                )}
              </fieldset>
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
              <Button type="submit" isPending={busy}>
                Create metric
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const FIELD_LABEL = "text-xs leading-4 font-semibold text-(--text-primary)";
const FIELD =
  "h-8 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 text-[13px] text-(--text-primary) outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-200";

/** A segmented single choice, as a radio group. */
function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
  hideLabel,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
  hideLabel?: boolean;
}): ReactNode {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      {!hideLabel && <span className={FIELD_LABEL}>{label}</span>}
      <span className="flex h-7 rounded-(--radius-6) bg-(--switch-container-bg) p-0.5">
        {options.map(([key, text]) => (
          <label
            key={key}
            className={`flex flex-1 cursor-pointer items-center justify-center rounded-(--radius-4) px-3 text-xs font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--focus-ring) ${
              value === key
                ? "bg-white text-(--text-primary) shadow-(--effect-raised)"
                : "text-(--text-secondary)"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={label}
              checked={value === key}
              onChange={() => onChange(key)}
            />
            {text}
          </label>
        ))}
      </span>
    </div>
  );
}
