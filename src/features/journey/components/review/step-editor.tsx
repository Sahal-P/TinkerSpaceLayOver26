"use client";

import { ArrowDown, ArrowUp, MapPin, Pencil, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type FormEvent } from "react";
import { z } from "zod";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { DirectionIndicator } from "@/components/direction-indicator";
import { Button } from "@/components/ui/button";
import { Field, controlStyles } from "@/components/ui/field";
import { stepDraftSchema, type Step, type StepDraft } from "@/features/journey/schemas";
import { formatDistance } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { DIRECTIONS, directionLabels } from "@/lib/wayfinding";

type StepEditorProps = {
  step: Step;
  index: number;
  total: number;
  sourceLanguage: string;
  /** New steps open straight into the form. */
  initiallyEditing?: boolean;
  onSave: (draft: StepDraft) => void;
  onCancelNew?: () => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
  onReviewed: () => void;
};

type Errors = Partial<Record<keyof StepDraft, string>>;

export function StepEditor({
  step,
  index,
  total,
  sourceLanguage,
  initiallyEditing = false,
  onSave,
  onCancelNew,
  onMove,
  onRemove,
  onReviewed,
}: StepEditorProps) {
  const [editing, setEditing] = useState(initiallyEditing);
  const [errors, setErrors] = useState<Errors>({});
  const id = useId();
  const unresolved = step.confidence !== "high" && !step.reviewed;
  const tone = step.confidence === "low" ? "critical" : "caution";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = stepDraftSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!result.success) {
      const fields = z.flattenError(result.error).fieldErrors;
      setErrors({
        instruction: fields.instruction?.[0],
        landmark: fields.landmark?.[0],
        direction: fields.direction?.[0],
        distanceM: fields.distanceM?.[0],
      });
      return;
    }
    setErrors({});
    onSave(result.data);
    setEditing(false);
  };

  const cancel = () => {
    setErrors({});
    if (initiallyEditing && !step.instruction) onCancelNew?.();
    setEditing(false);
  };

  const describedBy = (field: keyof StepDraft) => (errors[field] ? `${id}-${field}-message` : undefined);

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 py-6 sm:gap-x-6">
      <div className="flex flex-col items-center gap-3">
        <span className="font-display text-3xl text-ink-muted tabular-nums">{index + 1}</span>
        <DirectionIndicator direction={step.direction} size="sm" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.form
            key="form"
            onSubmit={submit}
            noValidate
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.outSoft }}
            className="grid gap-5"
            aria-label={`Edit step ${index + 1}`}
          >
            <Field id={`${id}-instruction`} label="Instruction" error={errors.instruction}>
              <textarea
                id={`${id}-instruction`}
                name="instruction"
                rows={2}
                defaultValue={step.instruction}
                aria-invalid={errors.instruction ? true : undefined}
                aria-describedby={describedBy("instruction")}
                className={cn(controlStyles, "resize-none")}
              />
            </Field>
            <Field id={`${id}-landmark`} label="Landmark" error={errors.landmark}>
              <input
                id={`${id}-landmark`}
                name="landmark"
                defaultValue={step.landmark}
                aria-invalid={errors.landmark ? true : undefined}
                aria-describedby={describedBy("landmark")}
                className={controlStyles}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={`${id}-direction`} label="Direction" error={errors.direction}>
                <select id={`${id}-direction`} name="direction" defaultValue={step.direction} className={controlStyles}>
                  {DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {directionLabels[direction]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={`${id}-distanceM`} label="Distance (m)" error={errors.distanceM}>
                <input
                  id={`${id}-distanceM`}
                  name="distanceM"
                  inputMode="numeric"
                  defaultValue={step.distanceM}
                  aria-invalid={errors.distanceM ? true : undefined}
                  aria-describedby={describedBy("distanceM")}
                  className={controlStyles}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                Save step
              </Button>
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.outSoft }}
            className="min-w-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <ConfidenceBadge level={step.confidence} reviewed={step.reviewed} />
              <span className="caps text-ink-muted">{step.distanceM ? formatDistance(step.distanceM) : directionLabels[step.direction]}</span>
            </div>
            <p className="mt-3 text-lg leading-snug text-pretty">{step.instruction}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {step.landmark}
            </p>
            {step.original ? (
              <p lang={sourceLanguage} className="mt-3 border-l border-line-strong pl-3 font-display text-sm text-ink-muted italic">
                “{step.original}”
              </p>
            ) : null}

            {unresolved ? (
              <div className={cn("mt-4 rounded-card p-4 text-sm", tone === "critical" ? "bg-critical-soft" : "bg-caution-soft")}>
                <p className={cn("font-medium", tone === "critical" ? "text-critical" : "text-caution")}>Why this is flagged</p>
                <p className="mt-1 text-ink">{step.note ?? "Some details were unclear in the recording."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={onReviewed}>
                    Looks right
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                    Fix it
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 -ml-2.5 flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label={`Edit step ${index + 1}`}>
                <Pencil aria-hidden className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move step ${index + 1} up`}>
                <ArrowUp aria-hidden className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onMove(1)}
                disabled={index === total - 1}
                aria-label={`Move step ${index + 1} down`}
              >
                <ArrowDown aria-hidden className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onRemove} disabled={total <= 1} aria-label={`Remove step ${index + 1}`}>
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
