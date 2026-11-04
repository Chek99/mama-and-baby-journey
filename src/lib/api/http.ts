/**
 * Thin HTTP client for the external backend. The backend address comes from
 * VITE_API_URL. Sessions are bearer tokens kept in this browser only.
 * The contract every endpoint must follow is in docs/BACKEND_API.md.
 */

export const API_URL: string = ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "").replace(/\/+$/, "");

export const isApiConfigured = () => API_URL.length > 0;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
}

const SESSION_KEY = "mnm.session";

function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getSession(): SessionTokens | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SessionTokens>;
    return typeof s.access_token === "string" && typeof s.refresh_token === "string" ? (s as SessionTokens) : null;
  } catch {
    return null;
  }
}

export function setSession(tokens: SessionTokens) {
  if (!hasStorage()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: tokens.access_token, refresh_token: tokens.refresh_token }));
}

export function clearSession() {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const current = getSession();
  if (!current) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as Partial<SessionTokens>;
      if (typeof body.access_token !== "string" || typeof body.refresh_token !== "string") return false;
      setSession(body as SessionTokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

type Method = "GET" | "POST";

/**
 * Calls the backend. Business failures come back as 200 with `{ ok: false }`;
 * non-2xx responses throw ApiError. A 401 triggers one token refresh + retry.
 */
export async function request<T>(method: Method, path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  if (!isApiConfigured()) throw new ApiError(0, "not_configured");
  const auth = opts.auth ?? true;

  const send = () => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    const token = auth ? getSession()?.access_token : undefined;
    if (token) headers["authorization"] = `Bearer ${token}`;
    let url = `${API_URL}${path}`;
    if (method === "GET" && body && typeof body === "object") {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
      }
      const s = qs.toString();
      if (s) url += `?${s}`;
    }
    return fetch(url, {
      method,
      headers,
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  };

  let res: Response;
  try {
    res = await send();
  } catch {
    throw new ApiError(0, "network");
  }

  if (res.status === 401 && auth && getSession()) {
    if (await refreshSession()) {
      try {
        res = await send();
      } catch {
        throw new ApiError(0, "network");
      }
    }
    if (res.status === 401) clearSession();
  }

  if (!res.ok) {
    let code = "http_error";
    try {
      const err = (await res.json()) as { error?: unknown };
      if (typeof err.error === "string") code = err.error;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
