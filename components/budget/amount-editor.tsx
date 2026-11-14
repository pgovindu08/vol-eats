"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { toNumber } from "@/lib/utils";

/**
 * Shows a saved number with an "Update" link, or an input when nothing is saved yet.
 * Used on Budget for the money questions that onboarding no longer asks.
 */
export function AmountEditor({
  id,
  label,
  hint,
  value,
  format,
  whole,
  onSave,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number | null;
  format: (n: number) => string;
  /** Whole numbers only (swipes). */
  whole?: boolean;
  onSave: (n: number) => Promise<boolean>;
  /** What to show once a value is saved (defaults to the formatted value). */
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value == null ? "" : String(value));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (value != null && !editing) {
    return (
      <div className="flex items-end justify-between gap-3">
        <div className="flex-1">{children ?? <span className="font-display text-2xl font-bold tabular-nums">{format(value)}</span>}</div>
        <button
          type="button"
          onClick={() => {
            setText(String(value));
            setEditing(true);
          }}
          className="-mb-2 min-h-11 shrink-0 px-1 text-sm font-medium text-muted underline underline-offset-4 hover:text-text"
        >
          Update<span className="sr-only"> {label.toLowerCase()}</span>
        </button>
      </div>
    );
  }

  async function save() {
    const n = toNumber(text);
    if (n === undefined || n < 0 || n > 10000 || (whole && !Number.isInteger(n))) {
      setError(whole ? "Enter a whole number" : "Enter an amount, like 250");
      return;
    }
    setError(null);
    setSaving(true);
    const ok = await onSave(n);
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <form
      noValidate
      className="flex items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field id={id} label={label} hint={hint} error={error ?? undefined} className="flex-1">
        <Input
          id={id}
          type="number"
          inputMode={whole ? "numeric" : "decimal"}
          step={whole ? 1 : 0.01}
          min={0}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
      </Field>
      <Button type="submit" className="mt-7" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
