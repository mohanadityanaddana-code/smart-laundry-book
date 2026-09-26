import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { BellRing, Loader2, MailCheck, Save, ShieldCheck } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const updateProfile = useMutation(api.profile.updateProfile);
  const prefs = useQuery(api.profile.getPrefs);
  const setPrefs = useMutation(api.profile.setPrefs);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setRoom(user.roomNumber ?? "");
    }
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <AppShell>
        <Skeleton className="h-64 rounded-2xl" />
      </AppShell>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name, phone, roomNumber: room });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const PREF_ROWS = [
    { key: "machineReady" as const, label: "Machine ready alerts", hint: "Tell me the moment my machine is free" },
    { key: "startingSoon" as const, label: "Starting-soon reminders", hint: "20-minute heads-up before my slot" },
    { key: "bookingUpdates" as const, label: "Booking updates", hint: "Confirmations, cancellations and reschedules" },
    { key: "weather" as const, label: "Weather & drying tips", hint: "Rain guidance after I finish laundry" },
  ];

  const handlePref = async (key: "bookingUpdates" | "machineReady" | "weather" | "startingSoon", value: boolean) => {
    try {
      await setPrefs({ [key]: value });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update preferences");
    }
  };

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your HVR PG laundry account details.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Editable details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Account details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98XXX XXXXX"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="room">Room number</Label>
                <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="A-101" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pg">PG name</Label>
                <Input id="pg" value="HVR PG" disabled />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Verification + status */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email verified</span>
                {!!user.emailVerificationTime ? (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <MailCheck className="mr-1 size-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">Pending</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="secondary" className="bg-primary/10 text-primary capitalize">
                  <ShieldCheck className="mr-1 size-3" />
                  {user.role}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="max-w-[10rem] truncate font-medium">{user.email}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="size-4 text-primary" /> Notification preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {prefs === undefined
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="my-1.5 h-9 rounded-lg" />
                  ))
                : PREF_ROWS.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{row.label}</p>
                        <p className="text-xs text-muted-foreground">{row.hint}</p>
                      </div>
                      <Switch
                        checked={prefs[row.key]}
                        onCheckedChange={(v) => handlePref(row.key, v)}
                        aria-label={row.label}
                      />
                    </div>
                  ))}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-5 text-xs leading-relaxed text-muted-foreground">
              Your email is your verified identity on HVR PG Laundry — it keeps
              the platform to one account per student. Booking and slot history
              are tied to it and can't be transferred.
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
