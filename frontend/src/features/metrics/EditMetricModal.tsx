import { Alert, Button, Input, Label, Modal, TextField, Tooltip } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import {
  createMetricTargetMutation,
  deleteMetricTargetMutation,
  replaceMetricTargetMutation,
  updateMetricMutation,
} from "../../client/@tanstack/react-query.gen";
import type {
  MetricRead,
  MetricUpdate,
  TargetCreate,
  TargetRead,
  TargetReplace,
} from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import { periodRange, today } from "../../period";
import {
  Choice,
  FIELD,
  FIELD_LABEL,
  MeasureAsMenu,
  presetFor,
  unitFor,
  ValueInput,
} from "../life-areas/area/NewMetricModal";
import { DatePickerField } from "../pickers/DatePicker";
import { currencySymbol, type Formatted, formatForInput, parseValue } from "./format";
import { CURRENCIES, type Preset } from "./presets";

type TargetKind = "none" | "per_period" | "reach_by";
type Aggregation = MetricRead["aggregation"];

/** The target in force today, or the next one. */
export function currentTarget(metric: MetricRead): TargetRead | undefined {
  return (
    metric.targets.find((t) => t.state === "in_progress") ??
    metric.targets.find((t) => t.state === "upcoming")
  );
}

/**
 * Edit all fields of an existing metric (name, format/unit for manual metrics,
 * aggregation, direction, and target). Source cannot change once created.
 */
export function EditMetricModal({ metric, onClose }: { metric: MetricRead; onClose: () => void }) {
  const queryClient = useQueryClient();
  const existing = currentTarget(metric);
  const initialPreset = presetFor(metric);
  const [title, setTitle] = useState(metric.title);
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [unit, setUnit] = useState(metric.unit ?? initialPreset.unit ?? "");
  const [aggregation, setAggregation] = useState<Aggregation>(metric.aggregation);
  const [direction, setDirection] = useState<"higher" | "lower">(metric.direction);
  const [kind, setKind] = useState<TargetKind>(existing?.kind ?? "none");
  const [value, setValue] = useState(
    existing ? formatForInput(existing.target_value, metric.format) : "",
  );
  const [period, setPeriod] = useState<"day" | "week" | "month">(existing?.period ?? "month");
  const [startDate, setStartDate] = useState(
    () => existing?.start_date ?? periodRange("month", today()).start,
  );
  const [endDate, setEndDate] = useState(existing?.end_date ?? "");
  const [error, setError] = useState<string | null>(null);

  const updateMetric = useMutation(updateMetricMutation());
  const createTarget = useMutation(createMetricTargetMutation());
  const replaceTarget = useMutation(replaceMetricTargetMutation());
  const deleteTarget = useMutation(deleteMetricTargetMutation());
  const busy =
    updateMetric.isPending ||
    createTarget.isPending ||
    replaceTarget.isPending ||
    deleteTarget.isPending;

  const fromStep = metric.source === "routine_step";
  const shown: Formatted = fromStep
    ? aggregation === "average"
      ? { format: "percent", unit: null }
      : { format: "number", unit: "days" }
    : { format: preset.format, unit: unitFor(preset, unit) };
  const format = shown.format ?? "number";
  const targetValue = parseValue(value, format);
  const keepingSameTargetKind = existing !== undefined && existing.kind === kind;
  const unchangedEndDate = keepingSameTargetKind && endDate === (existing.end_date ?? "");

  const missing = !title.trim()
    ? "Enter a name"
    : kind !== "none" && targetValue === null
      ? "Enter a target"
      : kind === "reach_by" && !endDate
        ? "Pick the date to reach it by"
        : kind === "reach_by" && !unchangedEndDate && endDate < today()
          ? "Pick a date from today on"
          : kind === "per_period" && !keepingSameTargetKind && !startDate
            ? "Pick the start date"
            : null;

  const choosePreset = (next: Preset) => {
    setPreset(next);
    setUnit(next.unit ?? "");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (missing || busy) return;
    setError(null);
    const body: MetricUpdate = fromStep
      ? { title: title.trim(), aggregation, direction }
      : {
          title: title.trim(),
          format: preset.format,
          unit: shown.unit,
          aggregation,
          direction,
        };
    try {
      await updateMetric.mutateAsync({ path: { metric_id: metric.id }, body });

      if (existing && kind === "none") {
        await deleteTarget.mutateAsync({ path: { target_id: existing.id } });
      } else if (!existing && kind !== "none" && targetValue !== null) {
        const target: TargetCreate =
          kind === "per_period"
            ? { kind, target_value: targetValue, period, start_date: startDate }
            : { kind, target_value: targetValue, start_date: today(), end_date: endDate };
        await createTarget.mutateAsync({ path: { metric_id: metric.id }, body: target });
      } else if (existing && kind !== "none" && targetValue !== null) {
        if (kind !== existing.kind) {
          await deleteTarget.mutateAsync({ path: { target_id: existing.id } });
          const target: TargetCreate =
            kind === "per_period"
              ? { kind, target_value: targetValue, period, start_date: startDate }
              : { kind, target_value: targetValue, start_date: today(), end_date: endDate };
          await createTarget.mutateAsync({ path: { metric_id: metric.id }, body: target });
        } else {
          const changed =
            targetValue !== existing.target_value ||
            (kind === "per_period" && period !== existing.period) ||
            (kind === "reach_by" && endDate !== existing.end_date);
          if (changed) {
            const replacement: TargetReplace =
              kind === "per_period"
                ? { target_value: targetValue, period }
                : { target_value: targetValue, end_date: endDate };
            await replaceTarget.mutateAsync({
              path: { target_id: existing.id },
              body: replacement,
            });
          }
        }
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
      <Modal.Container scroll="inside">
        <Modal.Dialog className="w-[520px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
          <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
            <Modal.Heading className="type-panel-title text-(--text-primary)">
              Edit metric
            </Modal.Heading>
            <IconButton label="Close" size="md" onPress={onClose}>
              <X />
            </IconButton>
          </Modal.Header>
          <form noValidate onSubmit={submit} className="flex min-h-0 flex-col">
            <Modal.Body className="m-0 flex flex-col gap-4 px-5 py-4">
              <TextField autoFocus value={title} onChange={setTitle} className="gap-1.5">
                <Label className={FIELD_LABEL}>Name</Label>
                <Input className="h-8 type-body" />
              </TextField>

              {fromStep ? (
                <div className="flex gap-3">
                  <Choice
                    label="Each period shows"
                    value={aggregation}
                    onChange={setAggregation}
                    options={[
                      ["sum", "Days done"],
                      ["average", "Completion rate"],
                    ]}
                  />
                  <div className="w-[150px]">
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
                </div>
              ) : (
                <>
                  <div className="flex gap-3">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <span className={FIELD_LABEL}>Measure as</span>
                      <MeasureAsMenu value={preset} onChange={choosePreset} />
                    </div>
                    {preset.id === "number" && (
                      <TextField value={unit} onChange={setUnit} className="w-[150px] gap-1.5">
                        <Label className={FIELD_LABEL}>Unit</Label>
                        <Input maxLength={20} placeholder="pieces" className="h-8 type-body" />
                      </TextField>
                    )}
                    {preset.units && (
                      <label className="flex w-[150px] flex-col gap-1.5">
                        <span className={FIELD_LABEL}>Unit</span>
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className={FIELD}
                        >
                          {preset.units.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {preset.format === "currency" && (
                      <label className="flex w-[150px] flex-col gap-1.5">
                        <span className={FIELD_LABEL}>Currency</span>
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className={FIELD}
                        >
                          {CURRENCIES.map((code) => (
                            <option key={code} value={code}>
                              {code} · {currencySymbol(code)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Choice
                      label="Each period shows"
                      value={aggregation}
                      onChange={setAggregation}
                      options={[
                        ["sum", "Total"],
                        ["average", "Average"],
                        ["latest", "Latest"],
                      ]}
                    />
                    <div className="w-[150px]">
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
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3 rounded-(--radius-8) border border-(--border-default) p-3">
                <Choice
                  label="Target"
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
                    <span className="w-[110px]">
                      <ValueInput
                        label="Target number"
                        metric={shown}
                        value={value}
                        onChange={setValue}
                      />
                    </span>
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
                        {!keepingSameTargetKind && (
                          <>
                            starting
                            <span className="w-[150px]">
                              <DatePickerField
                                label="Starting"
                                value={startDate}
                                onChange={setStartDate}
                              />
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        by
                        <span className="w-[150px]">
                          <DatePickerField label="Reach by" value={endDate} onChange={setEndDate} />
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
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
              <Tooltip delay={0} isDisabled={!missing}>
                <Tooltip.Trigger role="presentation" tabIndex={-1}>
                  <Button
                    type="submit"
                    isPending={busy}
                    isDisabled={missing !== null}
                    aria-describedby={missing ? "edit-metric-missing" : undefined}
                  >
                    Save changes
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>{missing}</Tooltip.Content>
              </Tooltip>
              {missing && (
                <span id="edit-metric-missing" className="sr-only">
                  {missing}
                </span>
              )}
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
