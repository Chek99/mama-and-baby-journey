import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { FormMessage, Spinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listFacilities } from "@/lib/api";
import { addStaff, changeStaffRole, issueTemporaryPassword, listStaff, setStaffActive, type StaffDto } from "@/lib/api";

const ROLE_LABEL: Record<string, string> = {
  hospital_admin: "Hospital admin",
  clinician: "Doctor / nurse",
  chv: "Community health volunteer",
};

const selectClass = "h-12 w-full rounded-xl border-2 border-input bg-card px-3 text-base";

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function TempPassword({ who, password, onClose }: { who: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3 rounded-2xl border-2 border-dashed border-sunny bg-sunny-soft p-4" role="status">
      <p className="font-bold">Temporary password for {who}</p>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-lg bg-card px-3 py-2 text-lg font-bold tracking-wide">{password}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(password).then(() => setCopied(true));
          }}
        >
          <Copy className="size-4" aria-hidden="true" />
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
      <p className="text-sm text-foreground/80">Share it privately. It is shown only once, and they must replace it when they first sign in.</p>
    </div>
  );
}

/**
 * Staff list + add form. scope "facility": a hospital admin's own staff.
 * scope "hospital_admins": the system admin creates and manages hospital admins.
 */
export function StaffManager({ scope }: { scope: "facility" | "hospital_admins" }) {
  const queryClient = useQueryClient();
  const fetchStaff = listStaff;
  const fetchFacilities = listFacilities;
  const add = addStaff;
  const changeRole = changeStaffRole;
  const setActive = setStaffActive;
  const tempPw = issueTemporaryPassword;

  const key = ["staff", scope];
  const staff = useQuery({ queryKey: key, queryFn: () => fetchStaff({ data: { scope } }) });
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: () => fetchFacilities(), enabled: scope === "hospital_admins" });

  const [role, setRole] = useState<"hospital_admin" | "clinician" | "chv">(scope === "facility" ? "clinician" : "hospital_admin");
  const [facilityId, setFacilityId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffId, setStaffId] = useState("");
  const [licence, setLicence] = useState("");
  const [cadre, setCadre] = useState("");
  const [ward, setWard] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [secret, setSecret] = useState<{ who: string; password: string } | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: () =>
      add({
        data: {
          role,
          facilityId: scope === "hospital_admins" ? facilityId : undefined,
          fullName,
          email,
          phone,
          staffId,
          licenceNumber: licence,
          cadre,
          ward,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        setSecret(res.tempPassword ? { who: fullName, password: res.tempPassword } : null);
        setMsg({ tone: "success", text: res.tempPassword ? "Account created." : "Account created. They can sign in with their phone number." });
        setFullName("");
        setEmail("");
        setPhone("");
        setStaffId("");
        setLicence("");
        setCadre("");
        setWard("");
        refresh();
      } else {
        setSecret(null);
        setMsg({
          tone: "error",
          text: res.error === "taken" ? "That email, phone number or staff ID is already used." : res.error === "forbidden" ? "You can't add this person here." : "Could not create the account. Check the details.",
        });
      }
    },
    onError: () => setMsg({ tone: "error", text: "Check the details. Email or phone may be invalid." }),
  });

  const act = useMutation({
    mutationFn: (v: { kind: "active" | "inactive" | "role" | "password"; s: StaffDto; role?: "hospital_admin" | "clinician" }) => {
      if (v.kind === "role") return changeRole({ data: { userId: v.s.userId, role: v.role } }).then(() => null);
      if (v.kind === "password") return tempPw({ data: { userId: v.s.userId } }).then((r) => (r.ok ? { who: v.s.fullName, password: r.tempPassword } : null));
      return setActive({ data: { userId: v.s.userId, active: v.kind === "active" } }).then(() => null);
    },
    onSuccess: (r) => {
      if (r) setSecret(r);
      refresh();
    },
    onError: () => setMsg({ tone: "error", text: "That action wasn't allowed." }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSecret(null);
    create.mutate();
  };

  const roleOptions = scope === "facility" ? (["clinician", "chv", "hospital_admin"] as const) : (["hospital_admin"] as const);

  return (
    <section className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl bg-muted/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="text-lg font-extrabold sm:col-span-2 lg:col-span-3">{scope === "facility" ? "Add staff" : "Add hospital admin"}</h2>
        {scope === "hospital_admins" && (
          <Field id="s-facility" label="Hospital">
            <select id="s-facility" className={selectClass} value={facilityId} onChange={(e) => setFacilityId(e.target.value)} required>
              <option value="">Choose a hospital…</option>
              {(facilities.data ?? [])
                .filter((f) => f.isActive)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {scope === "facility" && (
          <Field id="s-role" label="Role">
            <select id="s-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="s-name" label="Full name">
          <Input id="s-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
        </Field>
        {role === "chv" ? (
          <Field id="s-phone" label="Phone (required for CHVs)">
            <Input id="s-phone" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </Field>
        ) : (
          <>
            <Field id="s-email" label="Email">
              <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field id="s-phone" label="Phone (optional)">
              <Input id="s-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </>
        )}
        <Field id="s-staffid" label="Staff ID (optional)">
          <Input id="s-staffid" value={staffId} onChange={(e) => setStaffId(e.target.value)} />
        </Field>
        {role !== "chv" && (
          <>
            <Field id="s-licence" label="Licence number (optional)">
              <Input id="s-licence" value={licence} onChange={(e) => setLicence(e.target.value)} />
            </Field>
            <Field id="s-cadre" label="Cadre, e.g. nurse (optional)">
              <Input id="s-cadre" value={cadre} onChange={(e) => setCadre(e.target.value)} />
            </Field>
          </>
        )}
        {role === "chv" && (
          <Field id="s-ward" label="Ward (optional)">
            <Input id="s-ward" value={ward} onChange={(e) => setWard(e.target.value)} />
          </Field>
        )}
        <div className="flex items-end">
          <Button type="submit" variant="role" disabled={create.isPending} className="w-full">
            {create.isPending && <Spinner />}
            Create account
          </Button>
        </div>
        {msg && (
          <div className="sm:col-span-2 lg:col-span-3">
            <FormMessage tone={msg.tone}>{msg.text}</FormMessage>
          </div>
        )}
      </form>

      {secret && <TempPassword who={secret.who} password={secret.password} onClose={() => setSecret(null)} />}

      {staff.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground" role="status">
          <Spinner /> Loading…
        </div>
      )}
      {staff.error && <FormMessage>Could not load the list.</FormMessage>}
      {staff.data && staff.data.length === 0 && <p className="text-muted-foreground">Nobody added yet.</p>}
      {staff.data && staff.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 text-muted-foreground">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Role</th>
                {scope === "hospital_admins" && <th className="py-2 pr-4">Hospital</th>}
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.data.map((s) => (
                <tr key={s.userId} className="border-b align-top">
                  <td className="py-3 pr-4 font-bold">{s.fullName}</td>
                  <td className="py-3 pr-4">{ROLE_LABEL[s.role] ?? s.role}</td>
                  {scope === "hospital_admins" && <td className="py-3 pr-4">{s.facilityName ?? "—"}</td>}
                  <td className="py-3 pr-4">{s.email ?? s.phone ?? "—"}</td>
                  <td className="py-3 pr-4">
                    {s.isActive ? "Active" : "Inactive"}
                    {s.mustChangePassword && <span className="block text-xs text-muted-foreground">Temporary password</span>}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ kind: s.isActive ? "inactive" : "active", s })}>
                        {s.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                      {s.role !== "chv" && (
                        <Button type="button" size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ kind: "password", s })}>
                          Temporary password
                        </Button>
                      )}
                      {scope === "facility" && s.role !== "chv" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ kind: "role", s, role: s.role === "clinician" ? "hospital_admin" : "clinician" })}
                        >
                          {s.role === "clinician" ? "Make admin" : "Make doctor/nurse"}
                        </Button>
                      )}
                    </div>
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
