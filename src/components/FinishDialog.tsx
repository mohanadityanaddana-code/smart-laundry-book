import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Loader2,
  Sparkles,
  Umbrella,
} from "lucide-react";
import { useState } from "react";

type FinishResult = {
  ok: boolean;
  machineNumber: number;
  nextStudentName: string | null;
  nextStartSeconds: number | null;
};

type WeatherResult =
  | { ok: true; rainProbability: number; summary: string; guidance: string }
  | { ok: false; reason: string }
  | null;

type AiAdviceResult =
  | { ok: true; title: string; message: string; dryingTip: string; indoorRecommended: boolean; model: string }
  | { ok: false; reason: string; detail: string; model: string }
  | null;

function rainTone(p: number): string {
  if (p >= 60) return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
  if (p >= 35) return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
}

/**
 * "✨ Finish Laundry" — completes the cycle, notifies the next student, and
 * shows real drying-guidance weather fetched for the PG location.
 */
export function FinishDialog({
  bookingDbId,
  label,
  size = "default",
  variant = "default",
}: {
  bookingDbId: Id<"bookings">;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    finish: FinishResult;
    weather: WeatherResult;
    aiAdvice: AiAdviceResult;
  } | null>(null);

  const weather = useQuery(
    api.weather.forBooking,
    result ? { bookingDbId } : "skip",
  );

  const finishAction = useAction(api.finishFlow.finishAndFetchWeather);

  const handleFinish = async () => {
    setBusy(true);
    try {
      const res = await finishAction({ bookingDbId });
      setResult(res);
      toast.success("Laundry finished — the next student has been notified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not finish laundry");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setOpen(false);
    // Small delay so the closing dialog doesn't flash the pre-finish state.
    window.setTimeout(() => setResult(null), 300);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          {label ?? (
            <>
              <Sparkles className="mr-1.5 size-4" /> Finish &amp; notify next
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>Finish your laundry?</DialogTitle>
              <DialogDescription>
                We'll mark your cycle complete, notify the next student that the
                machine is ready, and fetch drying conditions for your clothes.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={reset} disabled={busy}>
                Not yet
              </Button>
              <Button onClick={handleFinish} disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                {busy ? "Finishing…" : "Finish laundry"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
                Laundry done — nicely done!
              </DialogTitle>
              <DialogDescription>
                {result.finish.nextStudentName
                  ? `${result.finish.nextStudentName} has been notified that Machine ${String(result.finish.machineNumber).padStart(2, "0")} is ready.`
                  : "No one is waiting for this machine right now."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {weather && "ok" in weather && weather.ok ? (
                <div className={`rounded-2xl border p-4 ${rainTone(weather.rainProbability)}`}>
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Umbrella className="size-4" />
                      {weather.rainProbability >= 60 ? "Rain likely" : weather.rainProbability >= 35 ? "Chance of rain" : "Good drying conditions"}
                    </p>
                    <p className="font-display text-2xl font-bold tabular-nums">
                      {weather.rainProbability}%
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-current/10">
                    <div
                      className="h-full rounded-full bg-current transition-all duration-700"
                      style={{ width: `${weather.rainProbability}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed opacity-90">
                    {weather.summary} {weather.guidance}
                  </p>
                </div>
              ) : weather === undefined ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Checking drying conditions…
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
                  <CloudOff className="mt-0.5 size-4 shrink-0" />
                  Weather information is temporarily unavailable. Your laundry
                  result is recorded — check the notification center later.
                </div>
              )}

              {result.finish.nextStudentName && result.finish.nextStartSeconds !== null && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowRight className="size-3.5" />
                  Next up: {result.finish.nextStudentName}
                </p>
              )}

              {/* Real Gemini advice (advisory only; booking outcome unchanged) */}
              {result.aiAdvice && result.aiAdvice.ok && (
                <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Sparkles className="size-4" />
                    {result.aiAdvice.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">
                    {result.aiAdvice.message}
                  </p>
                  {result.aiAdvice.dryingTip && (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      Tip: {result.aiAdvice.dryingTip}
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={reset}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
