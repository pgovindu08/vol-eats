"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { allergenList, DIET_LABELS } from "@/lib/diet";
import type { Allergen, MenuItem } from "@/lib/types";

export function MenuItemSheet({
  item,
  userAllergens,
  onClose,
  onLog,
}: {
  item: MenuItem | null;
  userAllergens: Allergen[];
  onClose: () => void;
  onLog: (item: MenuItem, servings: number) => void;
}) {
  return (
    <Sheet open={item !== null} onClose={onClose} title={item?.name ?? "Item"}>
      {item ? <Body key={item.id} item={item} userAllergens={userAllergens} onLog={onLog} /> : null}
    </Sheet>
  );
}

function Body({ item, userAllergens, onLog }: { item: MenuItem; userAllergens: Allergen[]; onLog: (item: MenuItem, servings: number) => void }) {
  const [servings, setServings] = useState(1);
  const flagged = item.allergens.filter((a) => userAllergens.includes(a));
  const rows = [
    { label: "Calories", value: item.calories, unit: "" },
    { label: "Protein", value: item.protein_g, unit: "g" },
    { label: "Carbs", value: item.carbs_g, unit: "g" },
    { label: "Fat", value: item.fat_g, unit: "g" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {[item.station, item.serving_size && `Serving: ${item.serving_size}`, item.price_usd != null && `$${item.price_usd.toFixed(2)}`]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {flagged.length ? (
        <p role="alert" className="flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-2 text-sm text-warning">
          <TriangleAlert aria-hidden className="size-4 shrink-0" /> Contains {allergenList(flagged, { lowercase: true })}, which you&apos;re avoiding.
        </p>
      ) : null}

      <dl className="grid grid-cols-4 gap-2 rounded-md bg-surface-2 p-3 text-center">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-muted">{r.label}</dt>
            <dd className="font-semibold tabular-nums">
              {Math.round(r.value * servings)}
              {r.unit}
            </dd>
          </div>
        ))}
      </dl>

      {item.tags.length || item.allergens.length ? (
        <div className="space-y-1 text-xs text-muted">
          {item.tags.length ? <p>{item.tags.map((t) => DIET_LABELS[t]).join(" · ")}</p> : null}
          {item.allergens.length ? <p>Allergens: {allergenList(item.allergens)}</p> : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Servings</span>
        <Stepper label="Servings" value={servings} onChange={setServings} />
      </div>
      <Button size="lg" block onClick={() => onLog(item, servings)}>
        Log {servings !== 1 ? `${servings} servings` : "it"} · {Math.round(item.calories * servings)} cal
      </Button>
    </div>
  );
}
