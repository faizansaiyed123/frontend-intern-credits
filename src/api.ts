import type {
  ApiHealth,
  ApplyMigrationResult,
  AuthResponse,
  AuthUser,
  CreditAccount,
  MigrationList,
} from "./types";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8000"
).replace(/\/+$/, "");

const SESSION_KEY = "mintline_access_token";

export function getAccessToken(): string {
  return typeof window === "undefined" ? "" : window.sessionStorage.getItem(SESSION_KEY) || "";
}

export function setAccessToken(token: string): void {
  window.sessionStorage.setItem(SESSION_KEY, token);
}

export function clearAccessToken(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      `Could not reach the API at ${API_BASE_URL}. Check that the backend is running and CORS allows this frontend origin.`,
    );
  }

  const responseText = await response.text();
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    if (typeof payload === "string" && payload.trim()) {
      message = payload;
    } else if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string") message = detail;
      else if (detail !== undefined) message = JSON.stringify(detail);
    }
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export function registerAccount(input: { name: string; email: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function loginAccount(input: { email: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me");
}

export async function logoutAccount(): Promise<void> {
  try {
    await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  } finally {
    clearAccessToken();
  }
}

export function getApiHealth(): Promise<ApiHealth> {
  return request<ApiHealth>("/healthz");
}

export function getCredits(userId: number, adminKey = ""): Promise<CreditAccount> {
  return request<CreditAccount>(`/api/credits/${userId}`, {
    headers: adminKey ? { "X-API-Key": adminKey } : undefined,
  });
}

export function addCredits(userId: number, amount: number, adminKey: string): Promise<CreditAccount> {
  return request<CreditAccount>(`/api/credits/${userId}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": adminKey },
    body: JSON.stringify({ amount }),
  });
}

export function deductCredits(userId: number, amount: number, adminKey: string): Promise<CreditAccount> {
  return request<CreditAccount>(`/api/credits/${userId}/deduct`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": adminKey },
    body: JSON.stringify({ amount }),
  });
}

export function resetCredits(userId: number, adminKey: string): Promise<CreditAccount> {
  return request<CreditAccount>(`/api/credits/${userId}/reset`, {
    method: "PATCH",
    headers: { "X-API-Key": adminKey },
  });
}

export function listMigrations(apiKey: string): Promise<MigrationList> {
  return request<MigrationList>("/api/schema/migrations", {
    headers: { "X-API-Key": apiKey },
  });
}

export function applyMigration(
  apiKey: string,
  migrationName: string,
  sql: string,
): Promise<ApplyMigrationResult> {
  return request<ApplyMigrationResult>("/api/schema/apply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ migration_name: migrationName, sql }),
  });
}
