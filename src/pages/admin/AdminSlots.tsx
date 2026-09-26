import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { secondsTo12h } from "@/lib/format";

type SettingsShape = {
  openTime: string;
  closeTime: string;
  defaultDurationMinutes: number;
  weeklyLimit: number;
  reminderTimeoutMinutes: number;
  finalResponseMinutes: number;
};

/** Live slot-grid preview for the current values. */
function SlotPreview({
  openTime,
  closeTime,
  durationMinutes,
}: {
  openTime: string;
  closeTime: string;
  durationMinutes: number;
}) {
  const toSec = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 3600 + (m || 0) * 60;
  };
  const open = toSec(openTime);
  const close = toSec(closeTime);
  const dur = Math.max(15, durationMinutes || 90) * 60;
  const slots: string[] = [];
  if (close > open && dur > 0) {
    let cursor = open;
    while (cursor + dur <= close && slots.length < 12) {
      const h24 = Math.floor(cursor / 3600);
      const m = Math.floor((cursor % 3600) / 60);
      const suffix = h24 >= 12 ? "PM" : "AM";
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      slots.push(`${h12}:${String(m).padStart(2, "0")} ${suffix}`);
      cursor += dur;
    }
  }
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {slots.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No slots fit inside these hours — closing time must be after opening time.
        </p>
      ) : (
        slots.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"
          >
            {s}
          </span>
        ))
      )}
      {close > open && dur > 0 && slots.length >= 12 && (
        <span className="rounded-md px-2 py-1 text-[11px] text-muted-foreground">…</span>
      )}
    </div>
  );
}

export default function AdminSlots() {
  const settings = useQuery(api.admin.getSettings);
  const update = useMutation(api.admin.updateSettings);
  const [form, setForm] = useState<SettingsShape | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        openTime: settings.openTime,
        closeTime: settings.closeTime,
        defaultDurationMinutes: settings.defaultDurationMinutes,
        weeklyLimit: settings.weeklyLimit,
        reminderTimeoutMinutes: settings.reminderTimeoutMinutes,
        finalResponseMinutes: settings.finalResponseMinutes,
      });
    }
  }, [settings, form]);

  const set = (patch: Partial<SettingsShape>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await update({
        openTime: form.openTime,
        closeTime: form.closeTime,
        defaultDurationMinutes: form.defaultDurationMinutes,
        weeklyLimit: form.weeklyLimit,
        reminderTimeoutMinutes: form.reminderTimeoutMinutes,
        finalResponseMinutes: form.finalResponseMinutes,
      });
      toast.success("Schedule saved — the booking engine now enforces these rules");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell>
      <div>
        <h1 className="font-display text-2xl font-bold">Slots & Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operating hours, slot duration, weekly limits and escalation timing. The
          booking engine enforces everything server-side — this is configuration,
          not hard-coding.
        </p>
      </div>

      {settings === undefined || !form ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Operating hours + duration */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daily operating hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="open">Opens at</Label>
                  <Input
                    id="open"
                    type="time"
                    value={form.openTime}
                    onChange={(e) => set({ openTime: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="close">Closes at</Label>
                  <Input
                    id="close"
                    type="time"
                    value={form.closeTime}
                    onChange={(e) => set({ closeTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dur">Default wash duration (minutes per slot)</Label>
                <Input
                  id="dur"
                  inputMode="numeric"
                  value={String(form.defaultDurationMinutes)}
                  onChange={(e) =>
                    set({ defaultDurationMinutes: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  15–240 minutes. Each machine can override this on the Machines page.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Today's slot grid preview
                </p>
                <SlotPreview
                  openTime={form.openTime}
                  closeTime={form.closeTime}
                  durationMinutes={form.defaultDurationMinutes}
                />
              </div>
            </CardContent>
          </Card>

          {/* Limits + escalation */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Booking limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="wl">Weekly booking limit per student</Label>
                  <Input
                    id="wl"
                    inputMode="numeric"
                    value={String(form.weeklyLimit)}
                    onChange={(e) => set({ weeklyLimit: parseInt(e.target.value, 10) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum confirmed bookings per student per week (Mon–Sun).
                    Cancelled bookings never consume the allowance.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Escalation timing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="rt">Reminder after (minutes)</Label>
                    <Input
                      id="rt"
                      inputMode="numeric"
                      value={String(form.reminderTimeoutMinutes)}
                      onChange={(e) =>
                        set({ reminderTimeoutMinutes: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ft">Final response window (minutes)</Label>
                    <Input
                      id="ft"
                      inputMode="numeric"
                      value={String(form.finalResponseMinutes)}
                      onChange={(e) =>
                        set({ finalResponseMinutes: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  When a machine is ready, the student is notified. If they don't
                  respond within the reminder window, a second notification plus a
                  voice call is sent. After the final window passes with no
                  response, the booking is auto-cancelled and the next student is
                  notified.
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Current hours: {secondsTo12hOpen(settings.openTime)} –{" "}
                {secondsTo12hOpen(settings.closeTime)} IST
              </p>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Save schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

/** Local 12h helper for the current persisted values. */
function secondsTo12hOpen(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
