import type {
  ApiHealth,
  ApplyMigrationResult,
  CreditAccount,
  MigrationList,
} from "./types";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8000"
).replace(/\/+$/, "");

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

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
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
      if (typeof detail === "string") {
        message = detail;
      } else if (detail !== undefined) {
        message = JSON.stringify(detail);
      }
    }

    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export function getApiHealth(): Promise<ApiHealth> {
  return request<ApiHealth>("/healthz");
}

export function getCredits(userId: number): Promise<CreditAccount> {
  return request<CreditAccount>(`/api/credits/${userId}`);
}

export function addCredits(userId: number, amount: number): Promise<CreditAccount> {
  return request<CreditAccount>(`/api/credits/${userId}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
}

export function deductCredits(userId: number, amount: number): Promise<CreditAccount> {
  return request<CreditAccount>(`/api/credits/${userId}/deduct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
}

export function resetCredits(userId: number): Promise<CreditAccount> {
  return request<CreditAccount>(`/api/credits/${userId}/reset`, {
    method: "PATCH",
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
