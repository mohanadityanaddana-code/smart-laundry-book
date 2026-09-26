import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Activity,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Loader2,
  Plus,
  Settings2,
  Users,
  WashingMachine,
  Wrench,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { friendlyDate, secondsTo12h } from "@/lib/format";

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

export default function Admin() {
  const stats = useQuery(api.admin.dashboardStats);
  const machines = useQuery(api.admin.adminMachines);
  const settings = useQuery(api.admin.getSettings);
  const students = useQuery(api.admin.students);
  const allBookings = useQuery(api.bookings.adminAllBookings);

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Live operations for HVR PG laundry.
      </p>

      <Tabs defaultValue="overview" className="mt-5">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="machines">Machines</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ------------------------------ OVERVIEW ------------------------------ */}
        <TabsContent value="overview" className="mt-5">
          {stats === undefined ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Students", value: stats.totals.students, icon: Users },
                  { label: "Machines", value: stats.totals.machines, icon: WashingMachine },
                  { label: "Available now", value: stats.totals.availableMachines, icon: CheckCircle2 },
                  { label: "Running now", value: stats.totals.runningMachines, icon: Activity },
                  { label: "Today's bookings", value: stats.totals.todayBookings, icon: CalendarDays },
                  { label: "This week", value: stats.totals.weekBookings, icon: CalendarDays },
                  { label: "Completed", value: stats.totals.completedBookings, icon: CheckCircle2 },
                  { label: "Cancelled", value: stats.totals.cancelledBookings, icon: XCircle },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                        <s.icon className="size-4 text-muted-foreground/60" />
                      </div>
                      <p className="mt-2 font-display text-2xl font-bold">{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Today's machine utilization</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold">{stats.utilization}%</p>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                      style={{ width: `${Math.min(100, stats.utilization)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ------------------------------- MACHINES ------------------------------ */}
        <TabsContent value="machines" className="mt-5">
          <MachinesTab machines={machines} />
        </TabsContent>

        {/* ------------------------------- BOOKINGS ------------------------------ */}
        <TabsContent value="bookings" className="mt-5">
          <BookingsTab bookings={allBookings} />
        </TabsContent>

        {/* ------------------------------- STUDENTS ------------------------------ */}
        <TabsContent value="students" className="mt-5">
          <StudentsTab students={students} />
        </TabsContent>

        {/* ------------------------------- SETTINGS ------------------------------ */}
        <TabsContent value="settings" className="mt-5">
          <SettingsTab settings={settings} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ------------------------------- MACHINES TAB ------------------------------ */

function MachinesTab({
  machines,
}: {
  machines: MachineRow[] | undefined;
}) {
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

  const patch = async (machineId: Id<"machines">, args: Record<string, unknown>) => {
    try {
      await updateMachine({ machineId, ...args });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Add, edit and control machines.</p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 size-4" /> Add machine
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a machine</DialogTitle>
              <DialogDescription>
                Duration applies to this machine only.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="m-num">Machine number</Label>
                <Input id="m-num" inputMode="numeric" value={form.machineNumber}
                  onChange={(e) => setForm({ ...form, machineNumber: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-name">Name</Label>
                <Input id="m-name" placeholder="Machine 04" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-cap">Capacity (kg)</Label>
                <Input id="m-cap" inputMode="decimal" value={form.capacityKg}
                  onChange={(e) => setForm({ ...form, capacityKg: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-loc">Location</Label>
                <Input id="m-loc" placeholder="Ground Floor" value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="m-dur">Cycle duration (minutes)</Label>
                <Input id="m-dur" inputMode="numeric" value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {machines === undefined
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
          : machines.map((m) => (
              <Card key={m._id}>
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
                    <MachineStatusBadge status={m.liveStatus} />
                  </div>

                  {m.liveStatus === "RUNNING" && m.runningRemainingSeconds !== null && (
                    <p className="mt-2 font-display text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {Math.floor(m.runningRemainingSeconds / 60)}:{String(m.runningRemainingSeconds % 60).padStart(2, "0")} left
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
                        patch(m._id, {
                          status: m.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE",
                        })
                      }
                    >
                      <Wrench className="mr-1.5 size-3.5" />
                      {m.status === "MAINTENANCE" ? "Clear maintenance" : "Set maintenance"}
                    </Button>
                    <div className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-1.5">
                      <span className="text-xs font-medium">Enabled</span>
                      <Switch
                        checked={m.active}
                        onCheckedChange={(v) => patch(m._id, { active: v, status: v ? "AVAILABLE" : "DISABLED" })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}

function MachineStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    RUNNING: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    RESERVED: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    AVAILABLE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    MAINTENANCE: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    OFFLINE: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    DISABLED: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return (
    <Badge variant="secondary" className={map[status] ?? map.AVAILABLE}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

/* ------------------------------- BOOKINGS TAB ------------------------------ */

type AdminBooking = {
  _id: string;
  bookingId: string;
  studentName: string;
  studentRoom: string;
  machineNumber: number;
  date: string;
  label12h: string;
  status: string;
  derived: string;
  cancellationReason: string | null;
  createdAt: number;
};

function BookingsTab({ bookings }: { bookings: AdminBooking[] | undefined }) {
  const cancelMyBooking = useMutation(api.bookings.cancelMyBooking);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = (bookings ?? []).filter((b) => {
    const q = search.toLowerCase();
    const matches =
      !q ||
      b.studentName.toLowerCase().includes(q) ||
      b.bookingId.toLowerCase().includes(q) ||
      String(b.machineNumber).includes(q);
    const statusOk = filter === "ALL" || b.derived === filter || (filter === "CANCELLED" && b.status === "CANCELLED");
    return matches && statusOk;
  });

  const doCancel = async (id: string) => {
    setBusy(id);
    try {
      await cancelMyBooking({ bookingDbId: id as never });
      toast.success("Booking cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search student, booking ID, machine…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="mt-4 space-y-2.5">
        {bookings === undefined ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No bookings match your search.
            </CardContent>
          </Card>
        ) : (
          filtered.slice(0, 60).map((b) => (
            <Card key={b._id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold">
                    {b.studentName}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Room {b.studentRoom || "—"} · ID {b.bookingId}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Machine {String(b.machineNumber).padStart(2, "0")} · {friendlyDate(b.date)} · {b.label12h}
                    {b.cancellationReason ? ` · ${b.cancellationReason.replace(/_/g, " ").toLowerCase()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      b.derived === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : b.derived === "CANCELLED"
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary"
                    }
                  >
                    {b.derived.charAt(0) + b.derived.slice(1).toLowerCase()}
                  </Badge>
                  {b.status === "CONFIRMED" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === b._id}>
                          <CalendarX2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {b.studentName}'s slot on {friendlyDate(b.date)} will
                            be freed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => doCancel(b._id)}
                          >
                            Cancel booking
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------- STUDENTS TAB ------------------------------ */

type StudentRow = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  roomNumber: string;
  role: string;
  disabled: boolean;
  emailVerified: boolean;
  bookingsThisWeek: number;
  totalBookings: number;
};

function StudentsTab({ students }: { students: StudentRow[] | undefined }) {
  const setStudentActive = useMutation(api.admin.setStudentActive);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = (students ?? []).filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.roomNumber.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = async (s: StudentRow) => {
    setBusy(s._id);
    try {
      await setStudentActive({ userId: s._id as never, active: s.disabled });
      toast.success(s.disabled ? "Account enabled" : "Account disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Input
        placeholder="Search students…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />
      <div className="mt-4 space-y-2.5">
        {students === undefined ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No students found.
            </CardContent>
          </Card>
        ) : (
          filtered.map((s) => (
            <Card key={s._id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold">
                    {s.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Room {s.roomNumber || "—"} · {s.email}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.bookingsThisWeek} this week · {s.totalBookings} total
                    {s.role === "admin" ? " · admin" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className={
                      s.disabled
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    }
                  >
                    {s.disabled ? "Disabled" : "Active"}
                  </Badge>
                  {s.role !== "admin" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === s._id}
                      onClick={() => toggle(s)}
                    >
                      {s.disabled ? "Enable" : "Disable"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------- SETTINGS TAB ------------------------------ */

type SettingsData = {
  openTime: string;
  closeTime: string;
  defaultDurationMinutes: number;
  weeklyLimit: number;
  supportName: string;
  supportPhone: string;
  emergencyPhone: string;
};

function SettingsTab({ settings }: { settings: SettingsData | undefined }) {
  const updateSettings = useMutation(api.admin.updateSettings);
  const [form, setForm] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (!settings || !form) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        openTime: form.openTime,
        closeTime: form.closeTime,
        defaultDurationMinutes: form.defaultDurationMinutes,
        weeklyLimit: form.weeklyLimit,
        supportName: form.supportName,
        supportPhone: form.supportPhone,
        emergencyPhone: form.emergencyPhone,
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const num = (v: string) => parseInt(v, 10) || 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="s-open">Opening time</Label>
            <Input
              id="s-open"
              type="time"
              value={form.openTime}
              onChange={(e) => setForm({ ...form, openTime: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-close">Closing time</Label>
            <Input
              id="s-close"
              type="time"
              value={form.closeTime}
              onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-dur">Default duration (minutes)</Label>
            <Input
              id="s-dur"
              inputMode="numeric"
              value={String(form.defaultDurationMinutes)}
              onChange={(e) =>
                setForm({ ...form, defaultDurationMinutes: num(e.target.value) })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-limit">Weekly limit per student</Label>
            <Input
              id="s-limit"
              inputMode="numeric"
              value={String(form.weeklyLimit)}
              onChange={(e) => setForm({ ...form, weeklyLimit: num(e.target.value) })}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            New machine durations default to this value. Slots never extend past
            closing time — a final slot that wouldn't fit is dropped.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PG owner & support</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="s-owner">Owner name</Label>
            <Input
              id="s-owner"
              value={form.supportName}
              onChange={(e) => setForm({ ...form, supportName: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-phone">Support phone</Label>
            <Input
              id="s-phone"
              value={form.supportPhone}
              onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-emg">Emergency phone</Label>
            <Input
              id="s-emg"
              value={form.emergencyPhone}
              onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Settings2 className="mr-2 size-4" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
