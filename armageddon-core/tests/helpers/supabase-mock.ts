import { vi } from 'vitest';
export const mockSupabaseClient = () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    })),
    channel: vi.fn(() => ({
      send: vi.fn().mockResolvedValue({ error: null })
    }))
  }))
});
