import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";
import { requirePortal } from "./me-query";

const SESSION_KEY = "mnm.session";

afterEach(() => window.localStorage.clear());

function seedMe(qc: QueryClient, roles: string[], extra: Record<string, unknown> = {}) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "a", refresh_token: "r" }));
  qc.setQueryData(["me"], { verified: true, roles, portal: roles.includes("clinician") ? "/clinician" : "/mother", mustChangePassword: false, ...extra });
}

async function redirectTarget(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e) {
    if (isRedirect(e)) return e.options.to;
    throw e;
  }
}

describe("portal access", () => {
  it("sends visitors without a session to sign-in", async () => {
    expect(await redirectTarget(requirePortal(new QueryClient(), ["clinician"]))).toBe("/auth");
  });

  it("lets a clinician into the clinician portal", async () => {
    const qc = new QueryClient();
    seedMe(qc, ["clinician"]);
    expect(await redirectTarget(requirePortal(qc, ["clinician"]))).toBeNull();
  });

  it("sends a mother away from the clinician portal to her own", async () => {
    const qc = new QueryClient();
    seedMe(qc, ["mother"]);
    expect(await redirectTarget(requirePortal(qc, ["clinician"]))).toBe("/mother");
  });

  it("forces a temporary password to be changed first", async () => {
    const qc = new QueryClient();
    seedMe(qc, ["clinician"], { mustChangePassword: true });
    expect(await redirectTarget(requirePortal(qc, ["clinician"]))).toBe("/change-password");
  });
});
