import type {
  ApiHealth,
  ApplyMigrationResult,
  AuthResponse,
  AuthUser,
  CreditAccount,
  MigrationList,
  SchemaMigration,
} from './types';

export const DEMO_CREDENTIALS = {
  email: 'demo@mintline.app',
  password: 'MintlineDemo2026!',
  creditAdminKey: 'mintline-demo-credit-operator',
  schemaAdminKey: 'mintline-demo-schema-admin',
} as const;

const STORAGE_KEY = 'mintline_demo_store_v1';
const SESSION_USER_KEY = 'mintline_demo_user_id';
const SESSION_EXPIRY_KEY = 'mintline_demo_expires_at';
const MAX_BALANCE = 2_147_483_647;

interface DemoStoredUser extends AuthUser {
  password: string;
  credits: number;
  last_updated: string;
}

interface DemoStore {
  users: DemoStoredUser[];
  migrations: SchemaMigration[];
  nextUserId: number;
  nextMigrationId: number;
}

export class DemoApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DemoApiError';
    this.status = status;
  }
}

function seededStore(): DemoStore {
  const now = new Date().toISOString();
  return {
    users: [
      {
        user_id: 1,
        email: DEMO_CREDENTIALS.email,
        name: 'Demo Workspace',
        password: DEMO_CREDENTIALS.password,
        credits: 1280,
        last_updated: now,
      },
      {
        user_id: 2,
        email: 'operations@mintline.app',
        name: 'Operations Team',
        password: 'OperationsDemo2026!',
        credits: 760,
        last_updated: now,
      },
    ],
    migrations: [
      {
        id: 1,
        migration_name: 'create_credit_workspace_indexes',
        applied_at: '2026-10-01T09:00:00.000Z',
      },
    ],
    nextUserId: 3,
    nextMigrationId: 2,
  };
}

function saveStore(store: DemoStore): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function readStore(): DemoStore {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initial = seededStore();
    saveStore(initial);
    return initial;
  }

  try {
    const parsed = JSON.parse(stored) as DemoStore;
    if (
      !Array.isArray(parsed.users) ||
      !Array.isArray(parsed.migrations) ||
      typeof parsed.nextUserId !== 'number' ||
      typeof parsed.nextMigrationId !== 'number'
    ) {
      throw new Error('Invalid demo state');
    }
    return parsed;
  } catch {
    const initial = seededStore();
    saveStore(initial);
    return initial;
  }
}

function fail(message: string, status: number): never {
  throw new DemoApiError(message, status);
}

function requireSession(): DemoStoredUser {
  const token = window.sessionStorage.getItem('mintline_access_token');
  const userId = Number(window.sessionStorage.getItem(SESSION_USER_KEY));
  const expiresAt = window.sessionStorage.getItem(SESSION_EXPIRY_KEY);
  if (!token || !Number.isSafeInteger(userId) || userId < 1 || !expiresAt) {
    return fail('Your session has expired. Please sign in again.', 401);
  }
  if (new Date(expiresAt).getTime() <= Date.now()) {
    window.sessionStorage.removeItem(SESSION_USER_KEY);
    window.sessionStorage.removeItem(SESSION_EXPIRY_KEY);
    return fail('Your session has expired. Please sign in again.', 401);
  }
  const user = readStore().users.find((entry) => entry.user_id === userId);
  if (!user) return fail('Your session is no longer available. Please sign in again.', 401);
  return user;
}

function makeAuthResponse(user: DemoStoredUser): AuthResponse {
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const randomId =
    window.crypto?.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2);
  window.sessionStorage.setItem(SESSION_USER_KEY, String(user.user_id));
  window.sessionStorage.setItem(SESSION_EXPIRY_KEY, expiresAt);
  return {
    access_token: 'mintline-demo-' + randomId,
    token_type: 'bearer',
    expires_at: expiresAt,
    user: {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
    },
  };
}

function validEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length > 255 ||
    !/^[^@\s]{1,64}@[^@\s.]+(?:\.[^@\s.]+)+$/.test(normalized)
  ) {
    return fail('Enter a valid email address', 422);
  }
  return normalized;
}

function requireCreditOperator(key: string): void {
  if (key !== DEMO_CREDENTIALS.creditAdminKey) {
    fail('A valid demo credit-operator key is required.', 403);
  }
}

function requireSchemaAdmin(key: string): void {
  if (key !== DEMO_CREDENTIALS.schemaAdminKey) {
    fail('A valid demo schema-admin key is required.', 401);
  }
}

function requireAccount(store: DemoStore, userId: number): DemoStoredUser {
  const user = store.users.find((entry) => entry.user_id === userId);
  if (!user) return fail('User not found', 404);
  return user;
}

function accountSnapshot(user: DemoStoredUser): CreditAccount {
  return {
    user_id: user.user_id,
    credits: user.credits,
    last_updated: user.last_updated,
  };
}

function validateDemoIndexSql(sql: string): void {
  const statement = sql.trim();
  if (!statement) return fail('SQL statement is required', 422);
  if (statement.length > 10_000) return fail('SQL statement is too long', 422);
  if (
    (statement.includes(';') && !statement.endsWith(';')) ||
    statement.slice(0, -1).includes(';') ||
    statement.includes('--') ||
    statement.includes('/*') ||
    statement.includes('*/')
  ) {
    return fail('Use one index statement without inline SQL comments', 400);
  }

  const normalized = statement.endsWith(';') ? statement.slice(0, -1).trim() : statement;
  const match = normalized.match(
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[A-Za-z_][A-Za-z0-9_$]*\s+ON\s+([A-Za-z_][A-Za-z0-9_$]*)\s*\(\s*([A-Za-z_][A-Za-z0-9_$]*(?:\s+(?:ASC|DESC))?(?:\s*,\s*[A-Za-z_][A-Za-z0-9_$]*(?:\s+(?:ASC|DESC))?)*)\s*\)$/i,
  );
  if (!match) {
    return fail('Only CREATE INDEX statements on approved application columns are allowed', 400);
  }

  const allowed: Record<string, Set<string>> = {
    users: new Set(['user_id', 'email', 'created_at']),
    credits: new Set(['user_id', 'last_updated']),
    schema_migrations: new Set(['id', 'migration_name', 'applied_at']),
    auth_sessions: new Set(['session_id', 'user_id', 'token_hash', 'expires_at', 'revoked_at']),
  };
  const table = match[1].toLowerCase();
  if (!allowed[table]) return fail('Index target table is not allowed', 400);
  const columns = match[2].split(',').map((part) => part.trim().split(/\s+/)[0].toLowerCase());
  if (columns.some((column) => !allowed[table].has(column))) {
    return fail('Index target column is not allowed', 400);
  }
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const name = input.name.trim();
  if (!name) return fail('Name is required', 422);
  if (input.password.length < 12 || input.password.length > 128) {
    return fail('Password must contain 12–128 characters', 422);
  }

  const email = validEmail(input.email);
  const store = readStore();
  if (store.users.some((user) => user.email === email)) {
    return fail('Unable to create an account with those details', 409);
  }

  const user: DemoStoredUser = {
    user_id: store.nextUserId,
    name,
    email,
    password: input.password,
    credits: 0,
    last_updated: new Date().toISOString(),
  };
  store.nextUserId += 1;
  store.users.push(user);
  saveStore(store);
  return makeAuthResponse(user);
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const email = validEmail(input.email);
  const user = readStore().users.find(
    (entry) => entry.email === email && entry.password === input.password,
  );
  if (!user) return fail('Invalid email or password', 401);
  return makeAuthResponse(user);
}

export async function getCurrentUser(): Promise<AuthUser> {
  const user = requireSession();
  return { user_id: user.user_id, email: user.email, name: user.name };
}

export async function logoutAccount(): Promise<void> {
  window.sessionStorage.removeItem(SESSION_USER_KEY);
  window.sessionStorage.removeItem(SESSION_EXPIRY_KEY);
}

export async function getApiHealth(): Promise<ApiHealth> {
  return { ok: true, time: new Date().toISOString() };
}

export async function getCredits(userId: number, adminKey = ''): Promise<CreditAccount> {
  const currentUser = requireSession();
  const store = readStore();
  const target = requireAccount(store, userId);
  if (currentUser.user_id !== userId && adminKey !== DEMO_CREDENTIALS.creditAdminKey) {
    return fail('User not found', 404);
  }
  return accountSnapshot(target);
}

export async function addCredits(
  userId: number,
  amount: number,
  adminKey: string,
): Promise<CreditAccount> {
  requireSession();
  requireCreditOperator(adminKey);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return fail('Amount must be a positive whole number', 422);
  }
  const store = readStore();
  const user = requireAccount(store, userId);
  if (user.credits > MAX_BALANCE - amount) return fail('Credit balance limit exceeded', 400);
  user.credits += amount;
  user.last_updated = new Date().toISOString();
  saveStore(store);
  return accountSnapshot(user);
}

export async function deductCredits(
  userId: number,
  amount: number,
  adminKey: string,
): Promise<CreditAccount> {
  requireSession();
  requireCreditOperator(adminKey);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return fail('Amount must be a positive whole number', 422);
  }
  const store = readStore();
  const user = requireAccount(store, userId);
  if (user.credits < amount) return fail('Insufficient credits', 400);
  user.credits -= amount;
  user.last_updated = new Date().toISOString();
  saveStore(store);
  return accountSnapshot(user);
}

export async function resetCredits(
  userId: number,
  adminKey: string,
): Promise<CreditAccount> {
  requireSession();
  requireCreditOperator(adminKey);
  const store = readStore();
  const user = requireAccount(store, userId);
  user.credits = 0;
  user.last_updated = new Date().toISOString();
  saveStore(store);
  return accountSnapshot(user);
}

export async function listMigrations(apiKey: string): Promise<MigrationList> {
  requireSchemaAdmin(apiKey);
  return { migrations: readStore().migrations.slice().sort((a, b) => b.id - a.id) };
}

export async function applyMigration(
  apiKey: string,
  migrationName: string,
  sql: string,
): Promise<ApplyMigrationResult> {
  requireSchemaAdmin(apiKey);
  const name = migrationName.trim();
  if (!name || name.length > 200) return fail('Migration name is required', 422);
  validateDemoIndexSql(sql);

  const store = readStore();
  if (store.migrations.some((entry) => entry.migration_name === name)) {
    return { status: 'skipped', reason: 'already_applied', migration_name: name };
  }
  store.migrations.push({
    id: store.nextMigrationId,
    migration_name: name,
    applied_at: new Date().toISOString(),
  });
  store.nextMigrationId += 1;
  saveStore(store);
  return { status: 'applied', migration_name: name };
}
