// frontend/src/lib/api.ts

// Thin HTTP client for the frontend. Provides three helpers with consistent error handling:
// - api: strict call (200–299 → parsed JSON; 204 → undefined; errors throw)
// - apiList: list-friendly (returns [] for 204/404/empty; errors throw)
// - apiMaybe: optional single-resource (returns null for 204/404/empty; errors throw)

import { getToken, clearToken } from "./auth";

type Json = unknown;

/** Base fetch wrapper that attaches auth header and normalizes transport errors. */
async function raw(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };

  // Attach bearer token when available.
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...opts, headers });
  } catch (e: any) {
    // Network-level failure (DNS, CORS, server down, offline, etc.).
    throw new Error(e?.message || "network_error");
  }

  // Clear token on 401 to trigger client-side re-auth flows.
  if (res.status === 401) {
    clearToken();
    throw new Error("unauthorized");
  }

  return res;
}

/**
 * Strict API call:
 * Behavior:
 * - 2xx → returns parsed JSON (or `undefined` for 204)
 * - 4xx/5xx → throws Error using server-provided {error|message} when present
 */
export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await raw(path, opts);

  // No content response.
  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    // Attempt to parse JSON error; fall back to generic status text.
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* ignore non-JSON body */
    }
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // Parse JSON body; tolerate accidental empty bodies on 200.
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
}

/**
 * List-friendly API:
 * Behavior:
 * - 200 → parsed JSON array (non-array payloads are coerced to [])
 * - 204/404/empty body → []
 * - other 4xx/5xx → throws
 */
export async function apiList<T = any>(path: string, opts: RequestInit = {}): Promise<T[]> {
  const res = await raw(path, opts);

  if (res.status === 204 || res.status === 404) return [];
  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* ignore non-JSON body */
    }
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // Defensive parsing: only return arrays; otherwise fall back to [].
  try {
    const data: Json = await res.json();
    if (Array.isArray(data)) return data as T[];
    return [];
  } catch {
    return [];
  }
}

/**
 * Optional/single-resource API:
 * Behavior:
 * - 200 → parsed JSON object
 * - 204/404/empty → null
 * - other 4xx/5xx → throws
 */
export async function apiMaybe<T = any>(path: string, opts: RequestInit = {}): Promise<T | null> {
  const res = await raw(path, opts);

  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* ignore non-JSON body */
    }
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
