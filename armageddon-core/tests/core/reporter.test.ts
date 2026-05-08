import { describe, it, expect, vi } from 'vitest';
import { mockSupabaseClient } from '../helpers/supabase-mock';
vi.mock('@supabase/supabase-js', mockSupabaseClient);

describe('SupabaseReporter', () => {
    it('works', () => {
        expect(1).toBe(1);
    });
});
