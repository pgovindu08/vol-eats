"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RotateCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, withAiFallback } from "@/lib/api";
import { fileToDataUrl } from "@/lib/image";
import type { FoodLogInput, MealPeriod, PhotoEstimate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FoodForm } from "./food-form";

type State =
  | { step: "idle" }
  | { step: "analyzing"; preview: string }
  | { step: "result"; preview: string; estimate: PhotoEstimate | null };

const CONFIDENCE: Record<PhotoEstimate["confidence"], { label: string; className: string }> = {
  high: { label: "High confidence", className: "text-success" },
  medium: { label: "Medium confidence", className: "text-warning" },
  low: { label: "Low confidence: double-check", className: "text-danger" },
};

export function PhotoLog({ mealPeriod, busy, onSave, saveLabel = "Save to today" }: { mealPeriod: MealPeriod; busy: boolean; onSave: (input: FoodLogInput) => void; saveLabel?: string }) {
  const [state, setState] = useState<State>({ step: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const run = useRef(0);

  // Free the preview's object URL when it changes or on unmount.
  const preview = state.step === "idle" ? null : state.preview;
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const id = ++run.current;
    const url = URL.createObjectURL(file);
    setState({ step: "analyzing", preview: url });
    let estimate: PhotoEstimate | null = null;
    try {
      const image = await fileToDataUrl(file);
      // If the AI is slow or fails, fall back to manual entry (a canned estimate would be wrong data).
      estimate = (await withAiFallback(api.ai.photo(image), () => null)).data;
    } catch {
      estimate = null;
    }
    if (run.current === id) setState({ step: "result", preview: url, estimate });
  }

  function reset() {
    run.current++;
    setState({ step: "idle" });
    if (inputRef.current) inputRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        id="photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {/* No `capture` here, so phones open the photo library instead of the camera. */}
      <input
        ref={libraryRef}
        id="photo-library"
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {state.step === "idle" ? (
        <label
          htmlFor="photo-input"
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-surface p-6 text-center transition-colors duration-150 hover:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-primary"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg">
            <Camera aria-hidden className="size-7" />
          </span>
          <span className="font-semibold">Snap your plate</span>
          <span className="text-sm text-muted">We&apos;ll estimate calories and macros. You can edit everything.</span>
        </label>
      ) : (
        <div className="relative overflow-hidden rounded-lg border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={state.preview} alt="Your meal" className={cn("aspect-4/3 w-full object-cover", state.step === "analyzing" && "opacity-60")} />
          {state.step === "analyzing" ? (
            <div role="status" className="absolute inset-0 flex items-center justify-center">
              <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium shadow-card">
                <Loader2 aria-hidden className="size-4 animate-spin" /> Analyzing…
              </span>
            </div>
          ) : null}
          <Button variant="secondary" size="sm" className="absolute right-2 top-2" onClick={reset}>
            <RotateCcw aria-hidden className="size-3.5" /> Retake
          </Button>
        </div>
      )}

      {state.step === "result" ? (
        <>
          {state.estimate ? (
            <div className="space-y-1">
              <p className={cn("inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold", CONFIDENCE[state.estimate.confidence].className)}>
                {CONFIDENCE[state.estimate.confidence].label}
              </p>
              {state.estimate.notes ? <p className="text-sm text-muted">{state.estimate.notes}</p> : null}
            </div>
          ) : (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-muted">
              <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" /> Couldn&apos;t analyze this photo right now. Enter what you ate below.
            </p>
          )}
          <FoodForm
            idPrefix="photo"
            defaults={state.estimate ?? undefined}
            mealPeriod={mealPeriod}
            source="photo"
            submitLabel={saveLabel}
            busy={busy}
            onSubmit={onSave}
          />
        </>
      ) : state.step === "idle" ? (
        <Button variant="secondary" block onClick={() => libraryRef.current?.click()}>
          <ImagePlus aria-hidden className="size-4" /> Choose from library
        </Button>
      ) : null}
    </div>
  );
}
