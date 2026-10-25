export interface CreditAccount {
  user_id: number;
  credits: number;
  last_updated: string;
}

export interface ApiHealth {
  ok: boolean;
  time: string;
}

export interface SchemaMigration {
  id: number;
  migration_name: string;
  applied_at: string;
}

export interface MigrationList {
  migrations: SchemaMigration[];
}

export interface ApplyMigrationResult {
  status: "applied" | "skipped";
  reason?: string;
  migration_name: string;
}

export type CreditOperation = "add" | "deduct" | "reset";


export interface AuthUser {
  user_id: number;
  email: string;
  name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  expires_at: string;
  user: AuthUser;
}
