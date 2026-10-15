import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLOUD_UNAVAILABLE_COPY,
  MAX_CLOUD_PAYLOAD_BYTES,
  assertCloudPayloadSize,
  buildShareUrl,
  cloudBoardLinks,
  fetchSharedDiagramByToken,
  getAuthRedirectUrl,
  getSupabaseConfig,
  isCloudConfigured,
  isForbiddenServiceRoleKey,
  listMyCloudDiagrams,
  loadCloudDiagramById,
  openSharedDiagramFromUrl,
  parseShareTokenFromUrl,
  revokeCloudDiagramShare,
  saveDiagramToCloud,
  sendMagicLink,
  setSupabaseClientForTests,
  shareCloudDiagram,
  type SupabaseClientLike,
  type SupabaseSelectBuilder,
  type SupabaseUpdateBuilder,
} from './supabase';
import { buildBoardDocument } from '../utils/boardFormat';

function createMockSupabase(options?: {
  user?: { id: string; email?: string | null } | null;
  upsertRow?: Record<string, unknown>;
  listRows?: Array<Record<string, unknown>>;
  singleRow?: Record<string, unknown>;
  rpcData?: unknown;
}) {
  const user = options && 'user' in options
    ? options.user
    : { id: 'user-123', email: 'author@teqcon.uk' };

  const upsertSpy = vi.fn();
  const updateSpy = vi.fn();
  const eqSpy = vi.fn();
  const rpcSpy = vi.fn().mockResolvedValue({
    data: options?.rpcData ?? [],
    error: null,
  });
  const signInWithOtpSpy = vi.fn().mockResolvedValue({ data: {}, error: null });
  const signOutSpy = vi.fn().mockResolvedValue({ error: null });

  const client: SupabaseClientLike = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: user ? { user } : null },
        error: null,
      }),
      signInWithOtp: signInWithOtpSpy,
      signOut: signOutSpy,
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => {
        const chain: SupabaseSelectBuilder = {
          eq: (col: string, val: unknown) => {
            eqSpy(col, val);
            return chain;
          },
          order: vi.fn().mockResolvedValue({
            data: options?.listRows ?? [],
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: options?.singleRow ?? null,
            error: options?.singleRow ? null : { message: 'Row not found' },
          }),
        };
        return chain;
      }),
      upsert: (values: Record<string, unknown>, upsertOpts?: { onConflict?: string }) => {
        upsertSpy(values, upsertOpts);
        return {
          select: () => ({
            single: vi.fn().mockResolvedValue({
              data: options?.upsertRow ?? {
                id: (values.id as string) || 'cloud-uuid-1',
                user_id: values.user_id,
                title: values.title,
                payload: values.payload,
                share_token: null,
                created_at: '2026-10-15T12:00:00.000Z',
                updated_at: values.updated_at,
              },
              error: null,
            }),
          }),
        };
      },
      update: (values: Record<string, unknown>) => {
        updateSpy(values);
        const chain: SupabaseUpdateBuilder = {
          eq: (col: string, val: unknown) => {
            eqSpy(col, val);
            return chain;
          },
          select: () => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'cloud-uuid-1',
                share_token: values.share_token ?? null,
              },
              error: null,
            }),
          }),
        };
        return chain;
      },
      delete: vi.fn(),
    })),
    rpc: rpcSpy,
  };

  return {
    client,
    spies: {
      upsertSpy,
      updateSpy,
      eqSpy,
      rpcSpy,
      signInWithOtpSpy,
      signOutSpy,
    },
  };
}

afterEach(() => {
  setSupabaseClientForTests(undefined);
  cloudBoardLinks.clear();
});

describe('DT-SAVE-01 Supabase migration & RLS contract', () => {
  it('defines public.diagrams, owner RLS policies, and security definer get_diagram_by_share_token RPC', () => {
    const sqlPath = resolve(
      process.cwd(),
      'supabase/migrations/20261015000000_dt_save_01_diagrams.sql',
    );
    const sql = readFileSync(sqlPath, 'utf8');

    expect(sql).toMatch(/create table if not exists public\.diagrams/i);
    expect(sql).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/i);
    expect(sql).toMatch(/payload jsonb not null/i);
    expect(sql).toMatch(/share_token text unique null/i);
    expect(sql).toMatch(/on public\.diagrams\s*\(user_id,\s*updated_at desc\)/i);
    expect(sql).toMatch(/alter table public\.diagrams enable row level security/i);
    expect(sql).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
    expect(sql).toMatch(/create or replace function public\.get_diagram_by_share_token\(p_token text\)/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/limit 1/i);
    expect(sql).toMatch(/grant execute on function public\.get_diagram_by_share_token\(text\) to anon, authenticated/i);
  });
});

describe('DT-SAVE-01 Supabase config, auth, save, load, share, and size guards', () => {
  it('returns null config when env is missing and blocks service_role keys', () => {
    expect(getSupabaseConfig({})).toBeNull();
    expect(isCloudConfigured({})).toBe(false);

    // JWT with {"role":"service_role"}
    const serviceRoleJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      btoa(JSON.stringify({ role: 'service_role', iss: 'supabase' })) +
      '.sig';
    expect(isForbiddenServiceRoleKey(serviceRoleJwt)).toBe(true);
    expect(isForbiddenServiceRoleKey('sb_secret_12345')).toBe(true);
    expect(
      getSupabaseConfig({
        VITE_SUPABASE_URL: 'https://nbhjwtmozsdtcgknrktf.supabase.co',
        VITE_SUPABASE_ANON_KEY: serviceRoleJwt,
      }),
    ).toBeNull();

    // Valid publishable anon JWT
    const anonJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      btoa(JSON.stringify({ role: 'anon', iss: 'supabase' })) +
      '.sig';
    expect(isForbiddenServiceRoleKey(anonJwt)).toBe(false);
    expect(
      getSupabaseConfig({
        VITE_SUPABASE_URL: 'https://nbhjwtmozsdtcgknrktf.supabase.co',
        VITE_SUPABASE_ANON_KEY: anonJwt,
      }),
    ).toEqual({
      url: 'https://nbhjwtmozsdtcgknrktf.supabase.co',
      anonKey: anonJwt,
    });
  });

  it('builds auth redirect URLs for production and localhost /app/', () => {
    expect(getAuthRedirectUrl('https://diagram-tool.teqcon.uk')).toBe(
      'https://diagram-tool.teqcon.uk/app/',
    );
    expect(getAuthRedirectUrl('http://localhost:5173')).toBe(
      'http://localhost:5173/app/',
    );
  });

  it('sends magic link with /app/ redirect', async () => {
    const { client, spies } = createMockSupabase({ user: null });
    const res = await sendMagicLink('jack@teqcon.uk', client, 'https://diagram-tool.teqcon.uk');
    expect(res.emailRedirectTo).toBe('https://diagram-tool.teqcon.uk/app/');
    expect(spies.signInWithOtpSpy).toHaveBeenCalledWith({
      email: 'jack@teqcon.uk',
      options: { emailRedirectTo: 'https://diagram-tool.teqcon.uk/app/' },
    });
  });

  it('upserts a portable v3 board document and updates idempotently when already linked', async () => {
    const { client, spies } = createMockSupabase();
    const boardInput = {
      title: 'Order Approval',
      mode: 'flow' as const,
      dslText: 'diagram: flow\ntitle: Order Approval\nstart Begin\nBegin -> Done\nend Done',
    };

    const first = await saveDiagramToCloud({
      board: boardInput,
      localBoardId: 'local-board-1',
      client,
      now: '2026-10-15T12:00:00.000Z',
    });

    expect(first.id).toBe('cloud-uuid-1');
    expect(spies.upsertSpy).toHaveBeenCalledTimes(1);
    const firstCallRow = spies.upsertSpy.mock.calls[0][0];
    expect(firstCallRow.id).toBeUndefined();
    expect(firstCallRow.user_id).toBe('user-123');
    expect(firstCallRow.title).toBe('Order Approval');
    expect(firstCallRow.payload).toMatchObject({
      version: '3.0',
      kind: 'board',
      board: {
        title: 'Order Approval',
        mode: 'flow',
      },
    });

    // Second save on the same localBoardId reuses cloud-uuid-1 idempotently
    await saveDiagramToCloud({
      board: { ...boardInput, title: 'Order Approval v2' },
      localBoardId: 'local-board-1',
      client,
      now: '2026-10-15T12:05:00.000Z',
    });

    expect(spies.upsertSpy).toHaveBeenCalledTimes(2);
    const secondCallRow = spies.upsertSpy.mock.calls[1][0];
    expect(secondCallRow.id).toBe('cloud-uuid-1');
    expect(secondCallRow.title).toBe('Order Approval v2');
  });

  it('enforces the 1.5 MB payload size guard before uploading', async () => {
    const { client, spies } = createMockSupabase();
    const hugeDsl = `diagram: architecture\ntitle: Huge\n# ${'x'.repeat(MAX_CLOUD_PAYLOAD_BYTES + 1024)}`;

    expect(() => assertCloudPayloadSize(hugeDsl)).toThrow(/1\.5 MB cloud save limit/i);

    await expect(
      saveDiagramToCloud({
        board: { title: 'Huge', mode: 'architecture', dslText: hugeDsl },
        client,
      }),
    ).rejects.toThrow(/1\.5 MB cloud save limit/i);

    expect(spies.upsertSpy).not.toHaveBeenCalled();
  });

  it('lists and loads only the signed-in user diagrams (RLS owner filter)', async () => {
    const fixtureDoc = buildBoardDocument(
      {
        title: 'Cloud Architecture',
        mode: 'architecture',
        dslText: 'diagram: architecture\ntitle: Cloud Architecture\nservice API {}',
      },
      '2026-10-15T12:00:00.000Z',
    );
    const { client, spies } = createMockSupabase({
      listRows: [
        {
          id: 'cloud-uuid-42',
          title: 'Cloud Architecture',
          updated_at: '2026-10-15T12:00:00.000Z',
          share_token: null,
        },
      ],
      singleRow: {
        id: 'cloud-uuid-42',
        user_id: 'user-123',
        title: 'Cloud Architecture',
        payload: fixtureDoc,
        share_token: null,
        updated_at: '2026-10-15T12:00:00.000Z',
      },
    });

    const list = await listMyCloudDiagrams(client);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Cloud Architecture');
    expect(spies.eqSpy).toHaveBeenCalledWith('user_id', 'user-123');

    const loaded = await loadCloudDiagramById('cloud-uuid-42', client);
    expect(loaded.portable.title).toBe('Cloud Architecture');
    expect(loaded.portable.mode).toBe('architecture');
    expect(loaded.portable.dslText).toContain('service API');
  });

  it('generates/rotates share_token and revokes it for the owner', async () => {
    const { client, spies } = createMockSupabase();
    cloudBoardLinks.set('local-1', { cloudId: 'cloud-uuid-1', shareToken: null });

    const shared = await shareCloudDiagram({
      cloudId: 'cloud-uuid-1',
      localBoardId: 'local-1',
      client,
      token: 'tok_abc123xyz',
    });

    expect(shared.shareToken).toBe('tok_abc123xyz');
    expect(shared.shareUrl).toBe('https://diagram-tool.teqcon.uk/app/?share=tok_abc123xyz');
    expect(spies.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ share_token: 'tok_abc123xyz' }),
    );
    expect(cloudBoardLinks.get('local-1')?.shareToken).toBe('tok_abc123xyz');

    await revokeCloudDiagramShare({
      cloudId: 'cloud-uuid-1',
      localBoardId: 'local-1',
      client,
    });

    expect(spies.updateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ share_token: null }),
    );
    expect(cloudBoardLinks.get('local-1')?.shareToken).toBeNull();
  });

  it('parses share URLs and opens a read-only fixture payload via get_diagram_by_share_token RPC', async () => {
    expect(parseShareTokenFromUrl('https://diagram-tool.teqcon.uk/app/?share=token_999')).toBe('token_999');
    expect(parseShareTokenFromUrl('?share=token_999')).toBe('token_999');
    expect(parseShareTokenFromUrl('https://diagram-tool.teqcon.uk/app/share/token_path')).toBe('token_path');
    expect(parseShareTokenFromUrl('https://diagram-tool.teqcon.uk/app/')).toBeNull();
    expect(buildShareUrl('token_999')).toBe('https://diagram-tool.teqcon.uk/app/?share=token_999');

    const fixturePayload = buildBoardDocument(
      {
        title: 'Shared AI Workflow',
        mode: 'flow',
        dslText: 'diagram: flow\ntitle: Shared AI Workflow\nstart A\nA -> B\nend B',
      },
      '2026-10-15T12:00:00.000Z',
    );

    // Anonymous visitor (user: null) can open shared link via RPC
    const { client, spies } = createMockSupabase({
      user: null,
      rpcData: [
        {
          id: 'shared-uuid-1',
          title: 'Shared AI Workflow',
          payload: fixturePayload,
          updated_at: '2026-10-15T12:00:00.000Z',
        },
      ],
    });

    const opened = await openSharedDiagramFromUrl(
      'https://diagram-tool.teqcon.uk/app/?share=token_999',
      client,
    );

    expect(spies.rpcSpy).toHaveBeenCalledWith('get_diagram_by_share_token', {
      p_token: 'token_999',
    });
    expect(opened).not.toBeNull();
    expect(opened?.readOnly).toBe(true);
    expect(opened?.title).toBe('Shared AI Workflow');
    expect(opened?.portable.mode).toBe('flow');
    expect(opened?.portable.dslText).toContain('Shared AI Workflow');

    // Missing/revoked token rejects cleanly
    const { client: emptyClient } = createMockSupabase({ user: null, rpcData: [] });
    await expect(fetchSharedDiagramByToken('revoked_tok', emptyClient)).rejects.toThrow(
      /not found or link was revoked/i,
    );
    await expect(fetchSharedDiagramByToken('tok', null)).rejects.toThrow(CLOUD_UNAVAILABLE_COPY);
  });
});
