"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import type { FoodLog } from "@/lib/types";

export interface LogActions {
  onUpdate: (id: string, patch: { servings: number }) => void;
  onDelete: (id: string) => void;
}

/** Edit servings or delete a logged meal. Works for any day: the caller supplies the save/delete actions. */
export function EditLogSheet({ log, onClose, onUpdate, onDelete }: { log: FoodLog | null; onClose: () => void } & LogActions) {
  return (
    <Sheet open={log !== null} onClose={onClose} title={log?.name ?? "Edit"}>
      {/* key resets the servings state each time a different log opens */}
      {log ? <EditLogBody key={log.id} log={log} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} /> : null}
    </Sheet>
  );
}

function EditLogBody({ log, onClose, onUpdate, onDelete }: { log: FoodLog; onClose: () => void } & LogActions) {
  const [servings, setServings] = useState(log.servings);

  const rows = [
    { label: "Calories", value: log.calories * servings, unit: "" },
    { label: "Protein", value: log.protein_g * servings, unit: "g" },
    { label: "Carbs", value: log.carbs_g * servings, unit: "g" },
    { label: "Fat", value: log.fat_g * servings, unit: "g" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Servings</span>
        <Stepper label="Servings" value={servings} onChange={setServings} />
      </div>
      <dl className="grid grid-cols-4 gap-2 rounded-md bg-surface-2 p-3 text-center">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-muted">{r.label}</dt>
            <dd className="font-semibold tabular-nums">
              {Math.round(r.value)}
              {r.unit}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          aria-label={`Delete ${log.name}`}
          className="text-danger"
          onClick={() => {
            onClose();
            onDelete(log.id);
          }}
        >
          <Trash2 aria-hidden className="size-4" /> Delete
        </Button>
        <Button
          size="lg"
          block
          disabled={servings === log.servings}
          onClick={() => {
            onClose();
            onUpdate(log.id, { servings });
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
