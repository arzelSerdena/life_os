import {
  Alert,
  Button,
  Dropdown,
  Header,
  Input,
  Label,
  Modal,
  TextField,
  Tooltip,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Circle, Folder, X } from "lucide-react";
import { Fragment, type ReactNode, useRef, useState } from "react";
import {
  createMetricMutation,
  createMetricTargetMutation,
  listRoutinesOptions,
} from "../../../client/@tanstack/react-query.gen";
import type { LifeAreaRead, MetricCreate, TargetCreate } from "../../../client/types.gen";
import { IconButton } from "../../../components/IconButton";
import { errorMessage } from "../../../errors";
import { periodRange, today } from "../../../period";
import { useDiscardGuard } from "../../confirming/useDiscardGuard";
import {
  currencySymbol,
  type Formatted,
  formatValue,
  inputAffixes,
  parseValue,
} from "../../metrics/format";
import { CURRENCIES, PRESETS, type Preset } from "../../metrics/presets";
import { DatePickerField } from "../../pickers/DatePicker";
import { areaDataAttribute } from "../palette";

type Source = "manual" | "routine_step";
type TargetKind = "none" | "per_period" | "reach_by";
type Aggregation = MetricCreate["aggregation"];

/**
 * Create a metric owned by this area: typed entries measured by a preset, or the days of
 * a routine step, with an optional current value and target (design/STYLE_GUIDE.md,
 * "New metric pop-up").
 */
export function NewMetricModal({
  lifeArea,
  project,
  stepId: fedBy,
  onClose,
}: {
  lifeArea: LifeAreaRead;
  /** Opened on a project page: the project owns the metric. */
  project?: { id: number; title: string };
  /** Opened from a routine step's "Feeds metric": counts that step's days. */
  stepId?: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<Source>(fedBy ? "routine_step" : "manual");
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [unit, setUnit] = useState("");
  const [stepId, setStepId] = useState<number | null>(fedBy ?? null);
  const [aggregation, setAggregation] = useState<Aggregation>("sum");
  const [direction, setDirection] = useState<"higher" | "lower">("higher");
  const [current, setCurrent] = useState("");
  const [kind, setKind] = useState<TargetKind>("none");
  const [value, setValue] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");
  const [startDate, setStartDate] = useState(() => periodRange("month", today()).start);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const snapshot = JSON.stringify([
    title,
    source,
    preset.id,
    unit,
    stepId,
    aggregation,
    direction,
    current,
    kind,
    value,
    period,
    startDate,
    endDate,
  ]);
  const initialSnapshot = useRef(snapshot);
  const guard = useDiscardGuard(snapshot !== initialSnapshot.current, onClose);
  const createMetric = useMutation(createMetricMutation());
  const createTarget = useMutation(createMetricTargetMutation());
  const routines = useQuery({ ...listRoutinesOptions(), enabled: source === "routine_step" });
  const busy = createMetric.isPending || createTarget.isPending;

  const fromStep = source === "routine_step";
  // A routine step counts days done (a number of days) or its completion rate (a percent).
  const shown: Formatted = fromStep
    ? aggregation === "average"
      ? { format: "percent", unit: null }
      : { format: "number", unit: "days" }
    : { format: preset.format, unit: unitFor(preset, unit) };
  const format = shown.format ?? "number";
  const currentValue = parseValue(current, format);
  const targetValue = parseValue(value, format);

  const missing = !title.trim()
    ? "Enter a name"
    : fromStep && stepId === null
      ? "Choose a routine step"
      : !fromStep && current.trim() && currentValue === null
        ? "Enter the current value as a number"
        : kind !== "none" && targetValue === null
          ? "Enter a target"
          : kind === "reach_by" && !endDate
            ? "Pick the date to reach it by"
            : kind === "reach_by" && endDate < today()
              ? "Pick a date from today on"
              : kind === "per_period" && !startDate
                ? "Pick the start date"
                : null;

  const changeSource = (next: Source) => {
    setSource(next);
    // Routine steps only count days done (sum) or a completion rate (average).
    if (next === "routine_step" && aggregation === "latest") setAggregation("sum");
  };

  const choosePreset = (next: Preset) => {
    setPreset(next);
    setUnit(next.unit ?? "");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (missing || busy) return;
    setError(null);
    const owner = { life_area_id: lifeArea.id, ...(project && { project_id: project.id }) };
    const body: MetricCreate = fromStep
      ? {
          title: title.trim(),
          source: "routine_step",
          routine_step_id: stepId,
          aggregation,
          direction: "higher",
          ...owner,
        }
      : {
          title: title.trim(),
          format: preset.format,
          unit: shown.unit,
          aggregation,
          direction,
          ...(currentValue !== null && { current_value: currentValue }),
          ...owner,
        };
    try {
      const metric = await createMetric.mutateAsync({ body });
      if (kind !== "none" && targetValue !== null) {
        const target: TargetCreate =
          kind === "per_period"
            ? { kind, target_value: targetValue, period, start_date: startDate }
            : { kind, target_value: targetValue, start_date: today(), end_date: endDate };
        await createTarget.mutateAsync({ path: { metric_id: metric.id }, body: target });
      }
      await queryClient.invalidateQueries();
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  const steps = (routines.data ?? [])
    .map((routine) => ({
      routine,
      steps: routine.steps.filter((step) => step.archived_at === null),
    }))
    .filter((group) => group.steps.length > 0);
  const chosenStep = steps.flatMap((group) => group.steps).find((step) => step.id === stepId);

  return (
    <>
      <Modal.Backdrop {...guard.backdropProps}>
        {/* Long content scrolls in the body, so the footer stays on screen. */}
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-[520px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
            <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
              <Modal.Heading className="type-panel-title text-(--text-primary)">
                New metric
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

                <div className="flex gap-3">
                  <div className="flex w-[200px] flex-col gap-1.5">
                    <span className={FIELD_LABEL}>Owner</span>
                    <span className={`${FIELD} flex items-center`}>
                      <span
                        data-area={areaDataAttribute(lifeArea.color)}
                        className="flex h-5 items-center gap-1 rounded-full bg-(--area-tint-active) px-2 text-[11px] font-medium text-(--area-text)"
                      >
                        {project ? (
                          <Folder
                            aria-hidden
                            className="size-3 text-(--area-solid)"
                            strokeWidth={2}
                          />
                        ) : (
                          <span aria-hidden className="size-1.5 rounded-full bg-(--area-solid)" />
                        )}
                        {project?.title ?? lifeArea.title}
                      </span>
                    </span>
                  </div>
                  <Choice
                    label="Source"
                    value={source}
                    onChange={changeSource}
                    options={[
                      ["manual", "Manual entries"],
                      ["routine_step", "Routine step"],
                    ]}
                  />
                </div>

                {fromStep ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <span className={FIELD_LABEL}>Routine step</span>
                      <Dropdown>
                        <Button
                          variant="secondary"
                          aria-label={`Routine step: ${chosenStep?.title ?? "Choose a step"}`}
                          className={PICKER}
                        >
                          <Circle aria-hidden className="size-3.5 text-(--text-tertiary)" />
                          {chosenStep ? (
                            <span className="flex-1 truncate text-left">{chosenStep.title}</span>
                          ) : (
                            <span className="flex-1 text-left text-(--text-disabled)">
                              Choose a step
                            </span>
                          )}
                          <ChevronDown aria-hidden className="size-3.5 text-(--text-tertiary)" />
                        </Button>
                        <Dropdown.Popover placement="bottom start" className="min-w-[280px]">
                          <Dropdown.Menu
                            aria-label="Routine step"
                            onAction={(key) => setStepId(Number(key))}
                            renderEmptyState={() => (
                              <p className="px-2 py-1.5 type-meta text-(--text-tertiary)">
                                {routines.isPending ? "Loading…" : "No routine steps yet."}
                              </p>
                            )}
                          >
                            {steps.map(({ routine, steps: routineSteps }) => (
                              <Fragment key={routine.id}>
                                <Dropdown.Section className="border-(--border-default) not-first:mt-1 not-first:border-t not-first:pt-1">
                                  <Header className="px-2 pt-1 pb-0.5 text-xs font-semibold text-(--text-tertiary)">
                                    {routine.title}
                                  </Header>
                                  {routineSteps.map((step) => (
                                    <Dropdown.Item
                                      key={step.id}
                                      id={String(step.id)}
                                      textValue={step.title}
                                    >
                                      <Label className="flex-1">{step.title}</Label>
                                      {step.id === stepId && (
                                        <Check
                                          aria-hidden
                                          className="size-3.5 text-(--color-neutral-700)"
                                          strokeWidth={2}
                                        />
                                      )}
                                    </Dropdown.Item>
                                  ))}
                                </Dropdown.Section>
                              </Fragment>
                            ))}
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    </div>
                    <Choice
                      label="Each period shows"
                      value={aggregation}
                      onChange={setAggregation}
                      options={[
                        ["sum", "Days done"],
                        ["average", "Completion rate"],
                      ]}
                    />
                  </>
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
                    <div className="flex w-[200px] flex-col gap-1.5">
                      <span aria-hidden className={FIELD_LABEL}>
                        Current value
                      </span>
                      <ValueInput
                        label="Current value"
                        metric={shown}
                        value={current}
                        onChange={setCurrent}
                      />
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
                          starting
                          <span className="w-[150px]">
                            <DatePickerField
                              label="Starting"
                              value={startDate}
                              onChange={setStartDate}
                            />
                          </span>
                        </>
                      ) : (
                        <>
                          by
                          <span className="w-[150px]">
                            <DatePickerField
                              label="Reach by"
                              value={endDate}
                              onChange={setEndDate}
                            />
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
                  {/* The wrapper only catches hover on the disabled button; screen readers
                    get the reason from aria-describedby. */}
                  <Tooltip.Trigger role="presentation" tabIndex={-1}>
                    <Button
                      type="submit"
                      isPending={busy}
                      isDisabled={missing !== null}
                      aria-describedby={missing ? "new-metric-missing" : undefined}
                    >
                      Create metric
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{missing}</Tooltip.Content>
                </Tooltip>
                {missing && (
                  <span id="new-metric-missing" className="sr-only">
                    {missing}
                  </span>
                )}
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {guard.dialog}
    </>
  );
}

/** The unit a preset saves: the typed or chosen one where the preset allows a choice. */
export function unitFor(preset: Preset, unit: string): string | null {
  if (preset.format === "percent" || preset.format === "duration") return null;
  if (preset.id === "number") return unit.trim() || null;
  return unit || preset.unit;
}

/** Matches an existing metric's format and unit back to its Measure as preset. */
export function presetFor(metric: Formatted): Preset {
  if (metric.format === "currency") return PRESETS.find((p) => p.id === "money") ?? PRESETS[0];
  if (metric.format === "percent") return PRESETS.find((p) => p.id === "percent") ?? PRESETS[0];
  if (metric.format === "duration") return PRESETS.find((p) => p.id === "time") ?? PRESETS[0];
  const metricUnit = metric.unit;
  if (metricUnit) {
    const matched = PRESETS.find(
      (p) => p.format === "number" && (p.unit === metricUnit || p.units?.includes(metricUnit)),
    );
    if (matched) return matched;
  }
  return PRESETS[0];
}

export const FIELD_LABEL = "text-xs leading-4 font-semibold text-(--text-primary)";
export const FIELD =
  "h-8 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 text-[13px] text-(--text-primary) outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-200";
const PICKER =
  "h-8 w-full justify-start gap-2 rounded-(--radius-6) border border-(--border-default) bg-(--bg-surface) px-2.5 text-[13px] font-normal text-(--text-primary)";

/** The "Measure as" picker: each preset's icon, name and a sample value. */
export function MeasureAsMenu({
  value,
  onChange,
}: {
  value: Preset;
  onChange: (preset: Preset) => void;
}) {
  const Icon = value.icon;
  return (
    <Dropdown>
      <Button variant="secondary" aria-label={`Measure as: ${value.label}`} className={PICKER}>
        <Icon aria-hidden className="size-3.5 text-(--text-tertiary)" />
        <span className="flex-1 text-left">{value.label}</span>
        <ChevronDown aria-hidden className="size-3.5 text-(--text-tertiary)" />
      </Button>
      <Dropdown.Popover placement="bottom start" className="min-w-[240px]">
        <Dropdown.Menu
          aria-label="Measure as"
          onAction={(key) => {
            const next = PRESETS.find((preset) => preset.id === key);
            if (next) onChange(next);
          }}
        >
          {PRESETS.map((preset) => {
            const PresetIcon = preset.icon;
            return (
              <Dropdown.Item key={preset.id} id={preset.id} textValue={preset.label}>
                <PresetIcon aria-hidden className="size-3.5 shrink-0 text-(--text-tertiary)" />
                <Label className={preset.id === value.id ? "font-medium" : undefined}>
                  {preset.label}
                </Label>
                <span className="ml-auto pl-4 type-meta text-(--text-tertiary) tabular-nums">
                  {formatValue(preset.sample, preset)}
                </span>
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** A number input showing the currency symbol before it, or the unit after it. */
export function ValueInput({
  label,
  metric,
  value,
  onChange,
}: {
  label: string;
  metric: Formatted;
  value: string;
  onChange: (value: string) => void;
}) {
  const { prefix, suffix } = inputAffixes(metric);
  return (
    <span
      className={`${FIELD} flex items-center gap-1 has-[:focus-visible]:border-brand-600 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-200`}
    >
      {prefix && <span className="text-(--text-tertiary)">{prefix}</span>}
      <input
        aria-label={label}
        inputMode={metric.format === "duration" ? "text" : "decimal"}
        placeholder={metric.format === "duration" ? "1:30" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent outline-none"
      />
      {suffix && <span className="shrink-0 text-(--text-tertiary)">{suffix}</span>}
    </span>
  );
}

/** A segmented single choice, as a radio group. */
export function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}): ReactNode {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-1 flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <span className="flex h-7 rounded-(--radius-6) bg-(--switch-container-bg) p-0.5">
        {options.map(([key, text]) => (
          <label
            key={key}
            className={`flex flex-1 cursor-pointer items-center justify-center rounded-(--radius-4) px-3 text-xs font-medium whitespace-nowrap has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--focus-ring) ${
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
