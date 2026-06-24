
import { describe, bench } from 'vitest';

describe('Stress Tester Request Management', () => {
  const MAX_VUS = 5000;
  const ITERATIONS = 10000;

  bench('Array: indexOf + splice', () => {
    const activeRequests: any[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      if (activeRequests.length < MAX_VUS) {
        const mockRequest = { id: i };
        const handler = () => {
          const idx = activeRequests.indexOf(mockRequest);
          if (idx > -1) activeRequests.splice(idx, 1);
        };
        activeRequests.push(mockRequest);

        // Simulate completion for half of them to keep it busy
        if (i % 2 === 0) {
            handler();
        }
      }
    }
  });

  bench('Set: add + delete', () => {
    const activeRequests = new Set<any>();
    for (let i = 0; i < ITERATIONS; i++) {
      if (activeRequests.size < MAX_VUS) {
        const mockRequest = { id: i };
        const handler = () => {
          activeRequests.delete(mockRequest);
        };
        activeRequests.add(mockRequest);

        if (i % 2 === 0) {
            handler();
        }
      }
    }
  });
});
