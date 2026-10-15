import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildBoardDocument,
  type BoardDocument,
  type PortableBoard,
} from '../utils/boardFormat';
import { parseOpenedBoardDocument } from '../utils/boardFile';
import type { Board } from '../utils/boardManager';

export const CLOUD_UNAVAILABLE_COPY = 'Cloud save unavailable';
/** 1.5 MB payload cap for cloud diagram saves (1,572,864 bytes). */
export const MAX_CLOUD_PAYLOAD_BYTES = Math.floor(1.5 * 1024 * 1024);
export const PRODUCTION_SITE_ORIGIN = 'https://diagram-tool.teqcon.uk';
export const SHARE_QUERY_PARAM = 'share';
const CLOUD_LINKS_STORAGE_KEY = 'diagram-tool-cloud-links-v1';
const ACTIVE_BOARD_FALLBACK_KEY = '__active__';

export interface CloudUser {
  id: string;
  email?: string | null;
}

export interface CloudDiagramSummary {
  id: string;
  title: string;
  updated_at: string;
  share_token: string | null;
}

export interface CloudDiagramRecord extends CloudDiagramSummary {
  user_id: string;
  payload: BoardDocument;
  created_at?: string;
}

export interface SharedDiagramRow {
  id: string;
  title: string;
  payload: BoardDocument;
  updated_at: string;
}

export interface CloudBoardLink {
  cloudId: string;
  shareToken?: string | null;
  updatedAt?: string;
}

export interface SupabaseEnvInput {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export interface SupabaseSelectBuilder {
  eq: (column: string, value: unknown) => SupabaseSelectBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface SupabaseUpsertBuilder {
  select: (columns?: string) => {
    single: () => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

export interface SupabaseUpdateBuilder {
  eq: (column: string, value: unknown) => SupabaseUpdateBuilder;
  select: (columns?: string) => {
    single: () => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

// Structural subset of SupabaseClient so unit tests can pass lightweight mocks.
export interface SupabaseClientLike {
  auth: {
    getSession: () => Promise<{
      data: { session: { user: { id: string; email?: string | null } } | null };
      error: { message: string } | null;
    }>;
    getUser?: () => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: { message: string } | null;
    }>;
    signInWithOtp: (params: {
      email: string;
      options?: { emailRedirectTo?: string };
    }) => Promise<{ data?: unknown; error: { message: string } | null }>;
    signOut: () => Promise<{ error: { message: string } | null }>;
    onAuthStateChange: (
      callback: (
        event: string,
        session: { user: { id: string; email?: string | null } } | null,
      ) => void,
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
  from: (table: string) => {
    select: (columns?: string) => SupabaseSelectBuilder;
    upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => SupabaseUpsertBuilder;
    update: (values: Record<string, unknown>) => SupabaseUpdateBuilder;
    delete?: () => unknown;
  };
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Guard against accidentally bundling a service_role or secret key into the browser.
 * Only publishable/anon keys are permitted in client configuration.
 */
export function isForbiddenServiceRoleKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (/^sb_secret_/i.test(trimmed) || /service_role/i.test(trimmed)) return true;
  const parts = trimmed.split('.');
  if (parts.length === 3) {
    try {
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const decoded = typeof atob === 'function' ? atob(padded) : '';
      if (/"role"\s*:\s*"service_role"/i.test(decoded)) return true;
    } catch {
      // Ignore malformed base64 segments; non-JWT publishable keys are allowed.
    }
  }
  return false;
}

export function getSupabaseConfig(
  env: SupabaseEnvInput = import.meta.env,
): { url: string; anonKey: string } | null {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
  if (!url || !anonKey) return null;
  if (isForbiddenServiceRoleKey(anonKey)) {
    console.error('Refusing to initialize Supabase client with a service_role or secret key.');
    return null;
  }
  return { url, anonKey };
}

export function isCloudConfigured(env: SupabaseEnvInput = import.meta.env): boolean {
  if (testClientOverride !== undefined) return testClientOverride !== null;
  return getSupabaseConfig(env) !== null;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';
let testClientOverride: SupabaseClientLike | null | undefined = undefined;

export function setSupabaseClientForTests(client: SupabaseClientLike | null | undefined): void {
  testClientOverride = client;
}

export function getSupabaseClient(env: SupabaseEnvInput = import.meta.env): SupabaseClientLike | null {
  if (testClientOverride !== undefined) return testClientOverride;
  const config = getSupabaseConfig(env);
  if (!config) return null;
  const configKey = `${config.url}::${config.anonKey}`;
  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    cachedConfigKey = configKey;
  }
  return cachedClient as unknown as SupabaseClientLike;
}

/**
 * Computes the magic-link redirect URL for `/app/`.
 * Supports https://diagram-tool.teqcon.uk/app/ and http://localhost:5173/app/.
 */
export function getAuthRedirectUrl(
  origin: string = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : PRODUCTION_SITE_ORIGIN,
): string {
  const cleanOrigin = origin.trim().replace(/\/+$/, '') || PRODUCTION_SITE_ORIGIN;
  return `${cleanOrigin}/app/`;
}

export async function getCurrentCloudUser(
  client: SupabaseClientLike | null = getSupabaseClient(),
): Promise<CloudUser | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.user) return null;
  return {
    id: data.session.user.id,
    email: data.session.user.email ?? null,
  };
}

export async function sendMagicLink(
  email: string,
  client: SupabaseClientLike | null = getSupabaseClient(),
  redirectOrigin?: string,
): Promise<{ emailRedirectTo: string }> {
  if (!client) {
    throw new Error(CLOUD_UNAVAILABLE_COPY);
  }
  const cleanEmail = email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Enter a valid email address.');
  }
  const emailRedirectTo = getAuthRedirectUrl(redirectOrigin);
  const { error } = await client.auth.signInWithOtp({
    email: cleanEmail,
    options: { emailRedirectTo },
  });
  if (error) {
    throw new Error(error.message || 'Could not send sign-in link.');
  }
  return { emailRedirectTo };
}

export async function signOutCloud(
  client: SupabaseClientLike | null = getSupabaseClient(),
): Promise<void> {
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message || 'Could not sign out.');
  }
}

export function measureCloudPayloadBytes(payload: BoardDocument | string): number {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return new TextEncoder().encode(serialized).byteLength;
}

export function assertCloudPayloadSize(
  payload: BoardDocument | string,
  maxBytes = MAX_CLOUD_PAYLOAD_BYTES,
): number {
  const bytes = measureCloudPayloadBytes(payload);
  if (bytes > maxBytes) {
    throw new Error(
      'Board exceeds the 1.5 MB cloud save limit. Remove large images or split the board, then try again.',
    );
  }
  return bytes;
}

export function buildCloudBoardPayload(
  board: Pick<Board, 'title' | 'mode' | 'dslText'> & Partial<Board>,
  exportedAt = new Date().toISOString(),
): BoardDocument {
  const doc = buildBoardDocument(board, exportedAt);
  assertCloudPayloadSize(doc);
  return doc;
}

class CloudBoardLinkStore {
  private memory = new Map<string, CloudBoardLink>();

  private key(localBoardId?: string | null): string {
    return localBoardId && localBoardId.trim() ? localBoardId.trim() : ACTIVE_BOARD_FALLBACK_KEY;
  }

  private readAll(): Record<string, CloudBoardLink> {
    const merged: Record<string, CloudBoardLink> = {};
    this.memory.forEach((value, key) => {
      merged[key] = value;
    });
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(CLOUD_LINKS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, CloudBoardLink>;
          if (parsed && typeof parsed === 'object') {
            for (const [k, v] of Object.entries(parsed)) {
              if (v && typeof v.cloudId === 'string' && v.cloudId) {
                merged[k] = v;
              }
            }
          }
        }
      } catch {
        // Ignore storage read errors in restricted environments.
      }
    }
    return merged;
  }

  private writeAll(records: Record<string, CloudBoardLink>): void {
    this.memory.clear();
    for (const [k, v] of Object.entries(records)) {
      this.memory.set(k, v);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(CLOUD_LINKS_STORAGE_KEY, JSON.stringify(records));
      } catch {
        // Ignore storage write errors in restricted environments.
      }
    }
  }

  get(localBoardId?: string | null): CloudBoardLink | undefined {
    const all = this.readAll();
    return all[this.key(localBoardId)];
  }

  set(localBoardId: string | null | undefined, link: CloudBoardLink): void {
    const all = this.readAll();
    all[this.key(localBoardId)] = link;
    this.writeAll(all);
  }

  updateShareToken(localBoardId: string | null | undefined, shareToken: string | null): void {
    const current = this.get(localBoardId);
    if (!current) return;
    this.set(localBoardId, { ...current, shareToken });
  }

  clear(localBoardId?: string | null): void {
    if (localBoardId === undefined) {
      this.memory.clear();
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(CLOUD_LINKS_STORAGE_KEY);
        } catch {
          // Ignore storage errors.
        }
      }
      return;
    }
    const all = this.readAll();
    delete all[this.key(localBoardId)];
    this.writeAll(all);
  }
}

export const cloudBoardLinks = new CloudBoardLinkStore();

export async function saveDiagramToCloud(input: {
  board: Pick<Board, 'title' | 'mode' | 'dslText'> & Partial<Board>;
  localBoardId?: string | null;
  cloudId?: string | null;
  client?: SupabaseClientLike | null;
  now?: string;
}): Promise<CloudDiagramRecord> {
  const client = input.client === undefined ? getSupabaseClient() : input.client;
  if (!client) {
    throw new Error(CLOUD_UNAVAILABLE_COPY);
  }
  const user = await getCurrentCloudUser(client);
  if (!user) {
    throw new Error('Sign in required to save to cloud.');
  }

  const timestamp = input.now ?? new Date().toISOString();
  const payload = buildCloudBoardPayload(input.board, timestamp);
  const title = payload.board.title.trim() || 'Untitled';
  const existingLink = cloudBoardLinks.get(input.localBoardId);
  const targetCloudId = input.cloudId ?? existingLink?.cloudId;

  const row: Record<string, unknown> = {
    ...(targetCloudId ? { id: targetCloudId } : {}),
    user_id: user.id,
    title,
    payload,
    updated_at: timestamp,
  };

  const { data, error } = await client
    .from('diagrams')
    .upsert(row, { onConflict: 'id' })
    .select('id, user_id, title, payload, share_token, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Could not save board to cloud.');
  }

  const record = data as CloudDiagramRecord;
  cloudBoardLinks.set(input.localBoardId, {
    cloudId: record.id,
    shareToken: record.share_token ?? existingLink?.shareToken ?? null,
    updatedAt: record.updated_at,
  });

  return record;
}

export async function listMyCloudDiagrams(
  client: SupabaseClientLike | null = getSupabaseClient(),
): Promise<CloudDiagramSummary[]> {
  if (!client) {
    throw new Error(CLOUD_UNAVAILABLE_COPY);
  }
  const user = await getCurrentCloudUser(client);
  if (!user) {
    throw new Error('Sign in required to load from cloud.');
  }

  const { data, error } = await client
    .from('diagrams')
    .select('id, title, updated_at, share_token')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Could not load cloud diagrams.');
  }

  return Array.isArray(data) ? (data as CloudDiagramSummary[]) : [];
}

export async function loadCloudDiagramById(
  id: string,
  client: SupabaseClientLike | null = getSupabaseClient(),
): Promise<{ record: CloudDiagramRecord; portable: PortableBoard }> {
  if (!client) {
    throw new Error(CLOUD_UNAVAILABLE_COPY);
  }
  const user = await getCurrentCloudUser(client);
  if (!user) {
    throw new Error('Sign in required to load from cloud.');
  }

  const { data, error } = await client
    .from('diagrams')
    .select('id, user_id, title, payload, share_token, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Cloud diagram could not be opened.');
  }

  const record = data as CloudDiagramRecord;
  const portable = parseOpenedBoardDocument(record.payload);
  if (record.title && record.title.trim()) {
    portable.title = record.title.trim();
  }
  return { record, portable };
}

export function generateShareToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function buildShareUrl(
  token: string,
  baseOrigin: string = PRODUCTION_SITE_ORIGIN,
): string {
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('Share token is required.');
  }
  const cleanOrigin = baseOrigin.trim().replace(/\/+$/, '') || PRODUCTION_SITE_ORIGIN;
  return `${cleanOrigin}/app/?${SHARE_QUERY_PARAM}=${encodeURIComponent(cleanToken)}`;
}

export function parseShareTokenFromUrl(searchOrUrl: string): string | null {
  const raw = searchOrUrl.trim();
  if (!raw) return null;

  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/app/${raw.startsWith('?') ? raw : `?${raw}`}`, PRODUCTION_SITE_ORIGIN);
    const paramToken = url.searchParams.get(SHARE_QUERY_PARAM)?.trim();
    if (paramToken) return paramToken;

    const pathMatch = url.pathname.match(/\/app\/share\/([^/?#]+)/i);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]).trim() || null;
    }
  } catch {
    const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
    const token = params.get(SHARE_QUERY_PARAM)?.trim();
    return token || null;
  }

  return null;
}

export function parseSharedBoardPayload(payload: unknown): {
  portable: PortableBoard;
  readOnly: true;
} {
  const portable = parseOpenedBoardDocument(payload);
  return { portable, readOnly: true };
}

export async function shareCloudDiagram(input: {
  cloudId: string;
  localBoardId?: string | null;
  client?: SupabaseClientLike | null;
  token?: string;
  baseOrigin?: string;
}): Promise<{ shareToken: string; shareUrl: string }> {
  const client = input.client === undefined ? getSupabaseClient() : input.client;
  if (!client) {
    throw new Error(CLOUD_UNAVAILABLE_COPY);
  }
  const user = await getCurrentCloudUser(client);
  if (!user) {
    throw new Error('Sign in required to share a diagram.');
  }

  const shareToken = (input.token ?? generateShareToken()).trim();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('diagrams')
    .update({ share_token: shareToken, updated_at: now })
    .eq('id', input.cloudId)
    .eq('user_id', user.id)
    .select('id, share_token')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Could not generate share link.');
  }

  const savedToken = (data as { share_token?: string }).share_token || shareToken;
  cloudBoardLinks.updateShareToken(input.localBoardId, savedToken);

  return {
    shareToken: savedToken,
    shareUrl: buildShareUrl(savedToken, input.baseOrigin),
  };
}

export async function revokeCloudDiagramShare(input: {
  cloudId: string;
  localBoardId?: string | null;
  client?: SupabaseClientLike | null;
}): Promise<void> {
  const client = input.client === undefined ? getSupabaseClient() : input.client;
  if (!client) {
    throw new Error(CLOUD_UNAVAILABLE_COPY);
  }
  const user = await getCurrentCloudUser(client);
  if (!user) {
    throw new Error('Sign in required to revoke a share link.');
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from('diagrams')
    .update({ share_token: null, updated_at: now })
    .eq('id', input.cloudId)
    .eq('user_id', user.id)
    .select('id, share_token')
    .single();

  if (error) {
    throw new Error(error.message || 'Could not revoke share link.');
  }

  cloudBoardLinks.updateShareToken(input.localBoardId, null);
}

export async function fetchSharedDiagramByToken(
  token: string,
  client: SupabaseClientLike | null = getSupabaseClient(),
): Promise<{
  id: string;
  title: string;
  updatedAt: string;
  portable: PortableBoard;
  payload: BoardDocument;
  readOnly: true;
}> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('Invalid share link.');
  }
  if (!client) {
    throw new Error(CLOUD_UNAVAILABLE_COPY);
  }

  const { data, error } = await client.rpc('get_diagram_by_share_token', {
    p_token: cleanToken,
  });

  if (error) {
    throw new Error(error.message || 'Could not open shared diagram.');
  }

  const row: SharedDiagramRow | null = Array.isArray(data)
    ? ((data[0] as SharedDiagramRow | undefined) ?? null)
    : ((data as SharedDiagramRow | null) ?? null);

  if (!row || !row.payload) {
    throw new Error('Shared diagram not found or link was revoked.');
  }

  const { portable, readOnly } = parseSharedBoardPayload(row.payload);
  const title = (row.title && row.title.trim()) || portable.title || 'Shared diagram';
  portable.title = title;

  return {
    id: row.id,
    title,
    updatedAt: row.updated_at,
    portable,
    payload: row.payload,
    readOnly,
  };
}

export async function openSharedDiagramFromUrl(
  searchOrUrl: string,
  client: SupabaseClientLike | null = getSupabaseClient(),
): Promise<{
  token: string;
  id: string;
  title: string;
  updatedAt: string;
  portable: PortableBoard;
  payload: BoardDocument;
  readOnly: true;
} | null> {
  const token = parseShareTokenFromUrl(searchOrUrl);
  if (!token) return null;
  const loaded = await fetchSharedDiagramByToken(token, client);
  return {
    token,
    ...loaded,
  };
}
