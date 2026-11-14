"use client";

import { useState } from "react";
import { Camera, ChevronRight, PenLine, Sparkles, UtensilsCrossed } from "lucide-react";
import { MEAL_PERIOD_LABELS } from "@/lib/meal-period";
import type { FoodLog, LogSource, MealPeriod } from "@/lib/types";
import { EditLogSheet, type LogActions } from "./edit-log-sheet";

const PERIODS: MealPeriod[] = ["breakfast", "lunch", "dinner"];
const SOURCE_ICON: Record<LogSource, typeof Camera> = { menu: UtensilsCrossed, plate: Sparkles, photo: Camera, manual: PenLine };
const SOURCE_LABEL: Record<LogSource, string> = { menu: "From menu", plate: "From plate pick", photo: "From photo", manual: "Added manually" };

/** A day's meals grouped by breakfast/lunch/dinner; tap one to edit or delete it. */
export function LoggedMeals({ logs, title, onUpdate, onDelete }: { logs: FoodLog[]; title: string } & LogActions) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = logs.find((l) => l.id === editingId) ?? null;

  return (
    <section aria-labelledby="logged-heading" className="space-y-4">
      <h2 id="logged-heading" className="sr-only">
        {title}
      </h2>
      {PERIODS.map((period) => {
        // Sorted by time logged, so an undone delete returns to its original spot.
        const items = logs.filter((l) => l.meal_period === period).sort((a, b) => a.logged_at.localeCompare(b.logged_at));
        if (!items.length) return null;
        const cals = items.reduce((s, l) => s + l.calories * l.servings, 0);
        return (
          <div key={period}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{MEAL_PERIOD_LABELS[period]}</h3>
              <span className="text-xs tabular-nums text-muted">{Math.round(cals)} cal</span>
            </div>
            <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
              {items.map((l) => {
                const Icon = SOURCE_ICON[l.source];
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setEditingId(l.id)}
                      disabled={l.id.startsWith("temp-")}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2 disabled:opacity-60"
                    >
                      {/* Name comes from the visible text (plus a hidden "Edit"), so voice control matches what's on screen. */}
                      <Icon aria-hidden className="size-4 shrink-0 text-muted" />
                      <span className="sr-only">Edit </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {l.servings !== 1 ? <span className="text-muted">{l.servings} × </span> : null}
                          {l.name}
                        </span>
                        <span className="block text-xs tabular-nums text-muted">
                          P {Math.round(l.protein_g * l.servings)} · C {Math.round(l.carbs_g * l.servings)} · F {Math.round(l.fat_g * l.servings)} g
                        </span>
                      </span>
                      <span className="sr-only">{SOURCE_LABEL[l.source]}, </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {Math.round(l.calories * l.servings)}
                        <span className="sr-only"> calories</span>
                      </span>
                      <ChevronRight aria-hidden className="size-4 text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <EditLogSheet log={editing} onClose={() => setEditingId(null)} onUpdate={onUpdate} onDelete={onDelete} />
    </section>
  );
}
