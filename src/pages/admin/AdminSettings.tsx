import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Cloud,
  Headphones,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

type SettingsShape = {
  supportName: string;
  supportPhone: string;
  emergencyPhone: string;
  latitude: number | null;
  longitude: number | null;
};

type TemplateRow = {
  _id: Id<"voiceTemplates">;
  name: string;
  type: string;
  text: string;
  active: boolean;
};

export default function AdminSettings() {
  const settings = useQuery(api.admin.getSettings);
  const update = useMutation(api.admin.updateSettings);
  const [support, setSupport] = useState<SettingsShape | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && !support) {
      setSupport({
        supportName: settings.supportName,
        supportPhone: settings.supportPhone,
        emergencyPhone: settings.emergencyPhone,
        latitude: settings.latitude,
        longitude: settings.longitude,
      });
    }
  }, [settings, support]);

  const handleSave = async () => {
    if (!support) return;
    setSaving(true);
    try {
      await update({
        supportName: support.supportName,
        supportPhone: support.supportPhone,
        emergencyPhone: support.emergencyPhone,
        latitude: support.latitude ?? undefined,
        longitude: support.longitude ?? undefined,
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell>
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Support contacts, PG location (weather) and the AI voice notification system.
        </p>
      </div>

      <Tabs defaultValue="general" className="mt-5">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="voice">AI voice calls</TabsTrigger>
        </TabsList>

        {/* ------------------------------ GENERAL ------------------------------ */}
        <TabsContent value="general" className="mt-4">
          {settings === undefined || !support ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Phone className="size-4 text-primary" /> Support contacts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="s-name">Support name</Label>
                    <Input
                      id="s-name"
                      value={support.supportName}
                      onChange={(e) => setSupport({ ...support, supportName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="s-phone">Support phone (shown on student dashboard)</Label>
                    <Input
                      id="s-phone"
                      value={support.supportPhone}
                      onChange={(e) => setSupport({ ...support, supportPhone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="e-phone">Emergency phone</Label>
                    <Input
                      id="e-phone"
                      value={support.emergencyPhone}
                      onChange={(e) => setSupport({ ...support, emergencyPhone: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MapPin className="size-4 text-primary" /> PG location (for weather)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="lat">Latitude</Label>
                      <Input
                        id="lat"
                        inputMode="decimal"
                        placeholder="12.9716"
                        value={support.latitude === null ? "" : String(support.latitude)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setSupport({ ...support, latitude: Number.isNaN(v) ? null : v });
                        }}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="lng">Longitude</Label>
                      <Input
                        id="lng"
                        inputMode="decimal"
                        placeholder="77.5946"
                        value={support.longitude === null ? "" : String(support.longitude)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setSupport({ ...support, longitude: Number.isNaN(v) ? null : v });
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <Cloud className="mr-1 inline size-3.5" />
                    Coordinates power the drying guidance shown after laundry. Weather
                    data comes from Open-Meteo (keyless). Without coordinates the app
                    honestly reports that weather is unavailable rather than inventing data.
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Timezone: IST (UTC+5:30)</p>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                      Save settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------- VOICE ------------------------------- */}
        <TabsContent value="voice" className="mt-4">
          <VoiceSection />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function VoiceSection() {
  const templates = useQuery(api.voice.adminListTemplates);
  const calls = useQuery(api.voice.adminListCalls);
  const preview = useQuery(api.voice.adminPreview, {});
  const saveTemplate = useMutation(api.voice.adminSaveTemplate);
  const deleteTemplate = useMutation(api.voice.adminDeleteTemplate);

  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", type: "machine_ready", text: "", active: true });

  const openCreate = () => {
    setForm({ name: "", type: "machine_ready", text: "", active: true });
    setCreating(true);
  };

  const handleSave = async () => {
    try {
      await saveTemplate({
        templateId: editing?._id,
        name: form.name.trim() || "Untitled template",
        type: form.type,
        text: form.text,
        active: form.active,
      });
      toast.success(editing ? "Template updated" : "Template created");
      setEditing(null);
      setCreating(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save template");
    }
  };

  const handleDelete = async (id: Id<"voiceTemplates">) => {
    try {
      await deleteTemplate({ templateId: id });
      toast.success("Template deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete template");
    }
  };

  return (
    <div className="space-y-4">
      {/* Status + preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Headphones className="size-4 text-primary" /> Voice provider status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={
                preview?.provider === "mock"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "bg-primary/10 text-primary"
              }
            >
              Provider: {preview?.provider ?? "mock"}
            </Badge>
            {preview?.provider === "mock" && (
              <span className="text-xs text-muted-foreground">
                Calls are recorded to history only. Set VOICE_PROVIDER and
                VOICE_PROVIDER_API_KEY env vars to deliver real AI voice calls.
              </span>
            )}
          </div>
          {preview?.rendered && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Active machine-ready template preview
              </p>
              <p className="mt-1.5 text-sm italic">“{preview.rendered}”</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Voice templates</CardTitle>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="mr-1.5 size-3.5" /> New template
          </Button>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {templates === undefined ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : templates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No templates yet. Create one with type “machine_ready” to customize the
              machine-ready voice call.
            </p>
          ) : (
            templates.map((t) => (
              <div
                key={t._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 p-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {t.name}
                    {t.active && (
                      <Badge variant="secondary" className="ml-2 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                        Active
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.type.replace(/_/g, " ")} · {t.text.length} chars
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground/80">“{t.text}”</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={t.active}
                    onCheckedChange={(v) =>
                      saveTemplate({
                        templateId: t._id,
                        name: t.name,
                        type: t.type,
                        text: t.text,
                        active: v,
                      }).catch((err: unknown) =>
                        toast.error(err instanceof Error ? err.message : "Could not update"),
                      )
                    }
                    aria-label={`Toggle ${t.name}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(t);
                      setForm({ name: t.name, type: t.type, text: t.text, active: t.active });
                    }}
                  >
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{t.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The template will be permanently removed from the database.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() => handleDelete(t._id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Call history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Voice call history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {calls === undefined ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : calls.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No calls yet. Calls are attempted during machine-ready escalation.
            </p>
          ) : (
            calls.slice(0, 20).map((c) => (
              <div
                key={c._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 p-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.targetName}</p>
                  <p className="text-muted-foreground">
                    {c.type.replace(/_/g, " ")} · attempt {c.attemptNumber} · {c.provider}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      c.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : c.status === "FAILED"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "bg-muted text-muted-foreground"
                    }
                  >
                    {c.status.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(c.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog
        open={creating || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "New voice template"}</DialogTitle>
            <DialogDescription>
              Variables: {"{student_name}"} {"{machine_number}"} {"{start_time}"}{" "}
              {"{end_time}"} {"{pg_name}"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-name">Template name</Label>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Machine ready — friendly"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-type">Type</Label>
              <select
                id="t-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="machine_ready">machine_ready</option>
                <option value="machine_ready_reminder">machine_ready_reminder</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-text">Text</Label>
              <Textarea
                id="t-text"
                rows={4}
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="Hello {student_name}, machine {machine_number} is ready for your {start_time} slot at {pg_name}."
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
              <span className="text-sm">Active</span>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={form.text.trim().length < 10}>
              {editing ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
