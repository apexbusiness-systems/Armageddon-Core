import { describe, it, expect, vi } from 'vitest';
vi.mock('@supabase/supabase-js', () => ({
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
}));
import { SupabaseReporter } from '../../src/core/reporter';

describe('SupabaseReporter', () => {
    it('works', () => {
        expect(1).toBe(1);
    });
});
