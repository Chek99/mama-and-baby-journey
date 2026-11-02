import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FormMessage, Spinner } from "@/components/common";
import { PortalShell } from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StaffManager } from "@/components/portal/StaffManager";
import { getSettings, listAuditLogs, listFacilities, saveFacility, setFacilityActive, updateSetting } from "@/lib/admin.functions";
import { requirePortal } from "@/lib/me-query";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "System admin — Mama na Mtoto" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => requirePortal(context.queryClient, ["system_admin"]),
  component: AdminHome,
});

const TABS = [
  { id: "hospitals", label: "Hospitals" },
  { id: "admins", label: "Hospital admins" },
  { id: "settings", label: "Settings" },
  { id: "audit", label: "Audit log" },
] as const;

function AdminHome() {
  const me = Route.useRouteContext();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("hospitals");
  return (
    <PortalShell me={me} title="System admin">
      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((k) => (
          <Button key={k.id} type="button" role="tab" aria-selected={tab === k.id} variant={tab === k.id ? "role" : "outline"} onClick={() => setTab(k.id)}>
            {k.label}
          </Button>
        ))}
      </div>
      {tab === "hospitals" && <Hospitals />}
      {tab === "admins" && <StaffManager scope="hospital_admins" />}
      {tab === "settings" && <Settings />}
      {tab === "audit" && <AuditLog />}
    </PortalShell>
  );
}

const SETTING_LABEL: Record<string, string> = {
  mother_can_view_full_schedule: "Mothers can see the full vaccine schedule",
  staff_idle_timeout_minutes: "Staff sign-out after idle (minutes, 5–120)",
  mother_idle_timeout_minutes: "Mother/CHV sign-out after idle (minutes, 5–240)",
};

function Settings() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getSettings);
  const save = useServerFn(updateSetting);
  const { data, isLoading, error } = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const update = useMutation({
    mutationFn: (v: { key: string; value: boolean | number }) => save({ data: v }),
    onSuccess: () => {
      setMsg({ tone: "success", text: "Saved." });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => setMsg({ tone: "error", text: "That value isn't allowed." }),
  });
  if (isLoading) return <Spinner />;
  if (error || !data) return <FormMessage>Could not load settings.</FormMessage>;
  return (
    <section className="space-y-4">
      {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
      {data.map((s) => (
        <div key={s.key} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 p-4">
          <div>
            <p className="font-bold">{SETTING_LABEL[s.key] ?? s.key}</p>
            {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
          </div>
          {typeof s.value === "boolean" ? (
            <Button type="button" variant={s.value ? "role" : "outline"} disabled={update.isPending} onClick={() => update.mutate({ key: s.key, value: !s.value })}>
              {s.value ? "On" : "Off"}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                aria-label={SETTING_LABEL[s.key] ?? s.key}
                className="w-24"
                inputMode="numeric"
                value={drafts[s.key] ?? String(s.value)}
                onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
              />
              <Button type="button" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ key: s.key, value: Number(drafts[s.key] ?? s.value) })}>
                Save
              </Button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function Hospitals() {
  const queryClient = useQueryClient();
  const fetchFacilities = useServerFn(listFacilities);
  const save = useServerFn(saveFacility);
  const toggle = useServerFn(setFacilityActive);
  const { data, isLoading, error } = useQuery({ queryKey: ["facilities"], queryFn: () => fetchFacilities() });
  const [name, setName] = useState("");
  const [mfl, setMfl] = useState("");
  const [county, setCounty] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const add = useMutation({
    mutationFn: () => save({ data: { name, mflCode: mfl, county, services: [] } }),
    onSuccess: (res) => {
      if (res.ok) {
        setName("");
        setMfl("");
        setCounty("");
        setMsg({ tone: "success", text: "Hospital added." });
        void queryClient.invalidateQueries({ queryKey: ["facilities"] });
      } else {
        setMsg({ tone: "error", text: res.error === "mfl_taken" ? "That MFL code is already used." : "Could not save. Check the details." });
      }
    },
    onError: () => setMsg({ tone: "error", text: "Could not save. Check the details." }),
  });
  const flip = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggle({ data: v }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["facilities"] }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    add.mutate();
  };

  return (
    <section className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl bg-muted/50 p-4 sm:grid-cols-4 sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="h-name">Hospital name</Label>
          <Input id="h-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="h-mfl">MFL code</Label>
          <Input id="h-mfl" value={mfl} onChange={(e) => setMfl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="h-county">County</Label>
          <Input id="h-county" value={county} onChange={(e) => setCounty(e.target.value)} required minLength={2} />
        </div>
        <Button type="submit" variant="role" disabled={add.isPending}>
          {add.isPending && <Spinner />}Add hospital
        </Button>
        {msg && (
          <div className="sm:col-span-4">
            <FormMessage tone={msg.tone}>{msg.text}</FormMessage>
          </div>
        )}
      </form>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground" role="status">
          <Spinner /> Loading…
        </div>
      )}
      {error && <FormMessage>Could not load hospitals.</FormMessage>}
      {data && data.length === 0 && <p className="text-muted-foreground">No hospitals yet. Add the first one above.</p>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 text-muted-foreground">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">MFL</th>
                <th className="py-2 pr-4">County</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((f) => (
                <tr key={f.id} className="border-b">
                  <td className="py-3 pr-4 font-bold">{f.name}</td>
                  <td className="py-3 pr-4">{f.mflCode ?? "—"}</td>
                  <td className="py-3 pr-4">{f.county}</td>
                  <td className="py-3 pr-4">{f.isActive ? "Active" : "Inactive"}</td>
                  <td className="py-3">
                    <Button type="button" size="sm" variant="outline" disabled={flip.isPending} onClick={() => flip.mutate({ id: f.id, active: !f.isActive })}>
                      {f.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AuditLog() {
  const fetchLogs = useServerFn(listAuditLogs);
  const { data, isLoading, error } = useQuery({ queryKey: ["audit"], queryFn: () => fetchLogs({ data: {} }) });
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground" role="status">
        <Spinner /> Loading…
      </div>
    );
  }
  if (error) return <FormMessage>Could not load the audit log.</FormMessage>;
  if (!data || data.rows.length === 0) return <p className="text-muted-foreground">No activity recorded yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 text-muted-foreground">
            <th className="py-2 pr-4">When</th>
            <th className="py-2 pr-4">Action</th>
            <th className="py-2 pr-4">Who</th>
            <th className="py-2 pr-4">Hospital</th>
            <th className="py-2">Result</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
              <td className="py-2 pr-4">{r.action}</td>
              <td className="py-2 pr-4">{r.actorName ?? "—"}</td>
              <td className="py-2 pr-4">{r.facilityName ?? "—"}</td>
              <td className="py-2">{r.success ? "OK" : "Failed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
