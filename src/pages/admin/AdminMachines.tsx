import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2, Plus, QrCode, Wrench } from "lucide-react";
import { useState } from "react";

type MachineRow = {
  _id: Id<"machines">;
  machineNumber: number;
  name: string;
  capacityKg: number;
  location: string;
  status: string;
  active: boolean;
  liveStatus: string;
  durationMinutes: number;
  runningRemainingSeconds: number | null;
  bookedToday: number;
  slotsToday: number;
};

export default function AdminMachines() {
  const machines = useQuery(api.admin.adminMachines);
  const addMachine = useMutation(api.admin.addMachine);
  const updateMachine = useMutation(api.admin.updateMachine);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ machineNumber: "", name: "", capacityKg: "", location: "", durationMinutes: "" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await addMachine({
        machineNumber: parseInt(form.machineNumber, 10),
        name: form.name,
        capacityKg: parseFloat(form.capacityKg),
        location: form.location,
        durationMinutes: parseInt(form.durationMinutes, 10),
      });
      toast.success("Machine added");
      setAddOpen(false);
      setForm({ machineNumber: "", name: "", capacityKg: "", location: "", durationMinutes: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add machine");
    } finally {
      setSaving(false);
    }
  };

  const patch = async (machineId: Id<"machines">, args: Record<string, unknown>, successMsg?: string) => {
    try {
      await updateMachine({ machineId, ...args });
      if (successMsg) toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Machines</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, configure and control every washing machine.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 size-4" /> Add machine
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a washing machine</DialogTitle>
              <DialogDescription>
                Duration applies to this machine only (15–240 minutes).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="m-num">Machine number</Label>
                <Input id="m-num" inputMode="numeric" value={form.machineNumber} onChange={(e) => setForm({ ...form, machineNumber: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-name">Name</Label>
                <Input id="m-name" placeholder="Machine 04" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-cap">Capacity (kg)</Label>
                <Input id="m-cap" inputMode="decimal" value={form.capacityKg} onChange={(e) => setForm({ ...form, capacityKg: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-loc">Location</Label>
                <Input id="m-loc" placeholder="Ground Floor" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="m-dur">Cycle duration (minutes)</Label>
                <Input id="m-dur" inputMode="numeric" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Add machine
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {machines === undefined
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)
          : machines.map((m) => (
              <MachineCard
                key={m._id}
                machine={m}
                onPatch={patch}
              />
            ))}
      </div>
    </AdminShell>
  );
}

function MachineCard({
  machine: m,
  onPatch,
}: {
  machine: MachineRow;
  onPatch: (id: Id<"machines">, args: Record<string, unknown>, msg?: string) => Promise<void>;
}) {
  const events = useQuery(api.adminPortal.machineEvents, { machineId: m._id });

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-sm font-bold">
              Machine {String(m.machineNumber).padStart(2, "0")} · {m.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.capacityKg} kg · {m.location} · {m.durationMinutes} min cycle
            </p>
          </div>
          <Badge
            variant="secondary"
            className={
              m.liveStatus === "RUNNING"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : m.liveStatus === "AVAILABLE"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : m.liveStatus === "RESERVED"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                    : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
            }
          >
            {m.liveStatus}
          </Badge>
        </div>

        {m.liveStatus === "RUNNING" && m.runningRemainingSeconds !== null && (
          <p className="mt-2 font-display text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {Math.floor(m.runningRemainingSeconds / 60)}:
            {String(m.runningRemainingSeconds % 60).padStart(2, "0")} left
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {m.bookedToday}/{m.slotsToday} slots booked today
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onPatch(m._id, { status: m.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE" },
                m.status === "MAINTENANCE" ? "Maintenance cleared" : "Machine set to maintenance")
            }
          >
            <Wrench className="mr-1.5 size-3.5" />
            {m.status === "MAINTENANCE" ? "Clear maintenance" : "Set maintenance"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onPatch(m._id, { status: m.status === "OFFLINE" ? "AVAILABLE" : "OFFLINE" },
                m.status === "OFFLINE" ? "Machine restored" : "Machine marked offline")
            }
          >
            {m.status === "OFFLINE" ? "Restore" : "Mark offline"}
          </Button>
          <div className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-1.5">
            <span className="text-xs font-medium">Enabled</span>
            <Switch
              checked={m.active}
              onCheckedChange={(v) =>
                onPatch(m._id, { active: v, status: v ? "AVAILABLE" : "DISABLED" },
                  v ? "Machine enabled" : "Machine disabled")
              }
            />
          </div>
        </div>

        {/* QR + event history */}
        <details className="mt-4">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-primary">
            <QrCode className="size-3.5" /> QR code & event history
          </summary>
          <div className="mt-3 rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">Machine QR URL (print and stick on the machine):</p>
            <code className="mt-1 block break-all rounded-md bg-muted px-2.5 py-1.5 text-xs">
              {`${window.location.origin}/machine/${m._id}`}
            </code>
            <p className="mt-3 text-xs font-semibold">Recent machine events</p>
            <div className="mt-1.5 space-y-1.5">
              {(events ?? []).slice(0, 5).map((e) => (
                <p key={e._id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{e.eventType.replace(/_/g, " ").toLowerCase()}</span> — {e.detail}
                </p>
              ))}
              {events !== undefined && events.length === 0 && (
                <p className="text-xs text-muted-foreground">No events recorded yet.</p>
              )}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
