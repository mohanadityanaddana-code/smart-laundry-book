import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Wrench,
  WashingMachine,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  dayOfMonth,
  durationLabel,
  friendlyDate,
  secondsTo12h,
  weekdayShort,
} from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";

type WeekData = {
  today: string;
  dates: Array<{ date: string; isToday: boolean; isPast: boolean }>;
  nowSeconds: number;
  serverNowMs: number;
};

type MachineCard = {
  _id: Id<"machines">;
  machineNumber: number;
  name: string;
  capacityKg: number;
  location: string;
  defaultDurationSeconds: number;
  liveStatus: string;
  totalSlots: number;
  openSlots: number;
};

type Availability = {
  machine: {
    _id: Id<"machines">;
    machineNumber: number;
    name: string;
    capacityKg: number;
    location: string;
    defaultDurationSeconds: number;
    storedStatus: string;
    liveStatus: string;
  };
  date: string;
  isPastDate: boolean;
  slots: Array<{
    start: number;
    end: number;
    label: string;
    label12h: string;
    status: "AVAILABLE" | "BOOKED" | "MAINTENANCE" | "PASSED";
    bookingId: string | null;
    isMine: boolean;
    bookedBy: string | null;
  }>;
  runningBooking: { bookingId: string; userName: string; endSeconds: number; remainingSeconds: number } | null;
  nextBooking: { bookingId: string; userName: string; startSeconds: number } | null;
};

const STEPS = ["Date", "Machine", "Slot", "Confirm"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 flex-col gap-1.5">
          <div
            className={`h-1.5 rounded-full transition-colors ${
              i <= current ? "bg-primary" : "bg-muted"
            }`}
          />
          <span
            className={`text-[11px] font-semibold ${
              i <= current ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Book() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Id<"machines"> | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: number; end: number } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const week = useQuery(api.bookings.currentWeek);
  const weekly = useQuery(api.bookings.weeklyUsage);
  const machines = useQuery(
    api.bookings.machineWithDayLoad,
    selectedDate ? { date: selectedDate } : "skip",
  );
  const availability = useQuery(
    api.bookings.machineAvailability,
    selectedMachine && selectedDate
      ? { machineId: selectedMachine, date: selectedDate }
      : "skip",
  );

  const confirmBooking = useMutation(api.bookings.confirmBooking);

  // Default to today once the week loads.
  useEffect(() => {
    if (week && !selectedDate) setSelectedDate(week.today);
  }, [week, selectedDate]);

  const machine = useMemo(
    () => machines?.find((m) => m._id === selectedMachine) ?? null,
    [machines, selectedMachine],
  );

  const atLimit = weekly !== undefined && weekly.remaining <= 0;

  const handleConfirm = async () => {
    if (!selectedMachine || !selectedDate || !selectedSlot) return;
    setConfirming(true);
    try {
      const result = await confirmBooking({
        machineId: selectedMachine,
        date: selectedDate,
        startSeconds: selectedSlot.start,
      });
      toast.success(`Booked! ${result.bookingId}`, {
        description: `${friendlyDate(selectedDate)} · ${secondsTo12h(selectedSlot.start)} – ${secondsTo12h(selectedSlot.end)}`,
      });
      navigate("/bookings");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not complete the booking";
      toast.error(message);
      setStep(2); // back to slot selection to re-choose
    } finally {
      setConfirming(false);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button variant="ghost" size="icon" onClick={() => setStep((s) => s - 1)} aria-label="Back">
            <ArrowLeft className="size-4.5" />
          </Button>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold">Book a slot</h1>
          <p className="text-sm text-muted-foreground">
            {weekly
              ? `${weekly.remaining} of ${weekly.limit} slots left this week`
              : "Loading your weekly allowance…"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Stepper current={step} />
      </div>

      {atLimit && step < 3 && (
        <Card className="mt-5 border-amber-300/60 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-300">
            You have reached your weekly limit. Cancel an upcoming booking or
            wait until Monday to book again.
          </CardContent>
        </Card>
      )}

      {/* ------------------------------ STEP 1: DATE ------------------------------ */}
      {step === 0 && (
        <div className="mt-6">
          {week === undefined ? (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {week.dates[0].date.slice(0, 4)} · This week only — new week opens Monday
              </p>
              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-7">
                {week.dates.map((d) => {
                  const disabled = d.isPast;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedDate(d.date);
                        setStep(1);
                      }}
                      className={`rounded-2xl border p-3 text-left transition-all ${
                        d.date === selectedDate
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/70 bg-card hover:border-primary/40 hover:shadow-sm"
                      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {weekdayShort(d.date)}
                      </p>
                      <p className="mt-1 font-display text-xl font-bold">{dayOfMonth(d.date)}</p>
                      {d.isToday && (
                        <Badge className="mt-1.5 bg-primary/15 text-[10px] text-primary" variant="secondary">
                          Today
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------------------------- STEP 2: MACHINE ---------------------------- */}
      {step === 1 && selectedDate && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            {friendlyDate(selectedDate)} — choose your machine
          </p>
          {machines === undefined ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {machines.map((m) => {
                const bookable =
                  m.liveStatus !== "MAINTENANCE" &&
                  m.liveStatus !== "OFFLINE" &&
                  m.liveStatus !== "DISABLED" &&
                  m.openSlots > 0;
                return (
                  <button
                    key={m._id}
                    type="button"
                    disabled={!bookable}
                    onClick={() => {
                      setSelectedMachine(m._id);
                      setSelectedSlot(null);
                      setStep(2);
                    }}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      bookable
                        ? "border-border/70 bg-card hover:border-primary/40 hover:shadow-md"
                        : "cursor-not-allowed border-border/40 bg-muted/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <WashingMachine className="size-5" />
                        </div>
                        <div>
                          <p className="font-display text-sm font-bold">
                            Machine {String(m.machineNumber).padStart(2, "0")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.capacityKg} kg · {m.location}
                          </p>
                        </div>
                      </div>
                      <StatusChip status={m.liveStatus} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground/80">
                        {durationLabel(m.defaultDurationSeconds)} per load
                      </span>
                      <span className={m.openSlots > 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                        {m.openSlots}/{m.totalSlots} slots open
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------ STEP 3: SLOT ------------------------------ */}
      {step === 2 && selectedMachine && selectedDate && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            {friendlyDate(selectedDate)} · Machine {machine ? String(machine.machineNumber).padStart(2, "0") : ""} — pick a time
          </p>
          {availability === undefined ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {availability.machine.liveStatus === "MAINTENANCE" && (
                <Card className="mt-3 border-zinc-300/60 bg-muted/50">
                  <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                    <Wrench className="size-4" /> This machine is under maintenance. Please pick another machine.
                  </CardContent>
                </Card>
              )}
              {availability.runningBooking && (
                <Card className="mt-3 border-amber-300/50 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-950/20">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
                        <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                      </span>
                      <span className="font-medium">
                        {availability.runningBooking.userName} is washing now
                      </span>
                    </div>
                    <span className="font-display text-sm font-bold tabular-nums">
                      {mmssLabel(availability.runningBooking.remainingSeconds)}
                    </span>
                  </CardContent>
                </Card>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {availability.slots.map((slot) => {
                  const selectable = slot.status === "AVAILABLE";
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={!selectable}
                      onClick={() => {
                        setSelectedSlot({ start: slot.start, end: slot.end });
                        setStep(3);
                      }}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        slot.status === "AVAILABLE"
                          ? "border-border/70 bg-card hover:border-primary/50 hover:shadow-md"
                          : slot.status === "BOOKED"
                            ? "cursor-not-allowed border-border/40 bg-muted/40"
                            : slot.status === "MAINTENANCE"
                              ? "cursor-not-allowed border-dashed border-border/60 bg-muted/20"
                              : "cursor-not-allowed border-border/30 bg-transparent opacity-50"
                      }`}
                    >
                      <p className={`font-display text-sm font-bold tabular-nums ${selectable ? "" : "text-muted-foreground"}`}>
                        {slot.label12h}
                      </p>
                      <p className="mt-1.5 text-xs">
                        {slot.status === "AVAILABLE" && (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Available</span>
                        )}
                        {slot.status === "BOOKED" && (
                          <span className="text-muted-foreground">
                            Booked{slot.bookedBy && !slot.isMine ? ` · ${slot.bookedBy}` : slot.isMine ? " · you" : ""}
                          </span>
                        )}
                        {slot.status === "MAINTENANCE" && <span className="text-muted-foreground">Maintenance</span>}
                        {slot.status === "PASSED" && <span className="text-muted-foreground/70">Passed</span>}
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ----------------------------- STEP 4: CONFIRM ----------------------------- */}
      {step === 3 && selectedMachine && selectedDate && selectedSlot && (
        <Card className="mx-auto mt-8 max-w-md overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-teal-700 px-6 py-5 text-primary-foreground">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Confirm your booking</p>
            <p className="mt-2 font-display text-2xl font-bold">
              {secondsTo12h(selectedSlot.start)} – {secondsTo12h(selectedSlot.end)}
            </p>
            <p className="text-sm opacity-85">{friendlyDate(selectedDate)}</p>
          </div>
          <CardContent className="p-6">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Student</dt>
                <dd className="font-semibold">{user?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Machine</dt>
                <dd className="font-semibold">
                  Machine {machine ? String(machine.machineNumber).padStart(2, "0") : ""}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-semibold">{machine?.location ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-semibold">{durationLabel(selectedSlot.end - selectedSlot.start)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Room</dt>
                <dd className="font-semibold">{user?.roomNumber || "—"}</dd>
              </div>
            </dl>
            <Button
              className="mt-6 w-full"
              size="lg"
              disabled={confirming}
              onClick={handleConfirm}
            >
              {confirming ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 size-4" />
              )}
              {confirming ? "Confirming…" : "Confirm booking"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Slots are held instantly once confirmed. Cancel anytime from My Bookings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick summary bar once a date is chosen */}
      {step === 2 && selectedMachine && selectedDate && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> {friendlyDate(selectedDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" /> {machine ? durationLabel(machine.defaultDurationSeconds) : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <WashingMachine className="size-3.5" /> Machine {machine ? String(machine.machineNumber).padStart(2, "0") : ""}
          </span>
        </div>
      )}
    </AppShell>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; ping?: boolean }> = {
    RUNNING: { cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400", label: "Running", ping: true },
    RESERVED: { cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400", label: "Reserved" },
    AVAILABLE: { cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Available" },
    MAINTENANCE: { cls: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400", label: "Maintenance" },
    OFFLINE: { cls: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400", label: "Offline" },
    DISABLED: { cls: "bg-red-500/10 text-red-600 dark:text-red-400", label: "Disabled" },
  };
  const s = map[status] ?? map.AVAILABLE;
  return (
    <Badge variant="secondary" className={s.cls}>
      {s.ping && (
        <span className="relative mr-1.5 inline-flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
        </span>
      )}
      {s.label}
    </Badge>
  );
}

function mmssLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
