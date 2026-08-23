import { describe, it, expect } from 'vitest';
import { validateBatteryIds } from '../src/types';

describe('validateBatteryIds', () => {
  it('should return default batteries when input is undefined', () => {
    const result = validateBatteryIds(undefined);
    expect(result).toEqual(['B10', 'B11', 'B12', 'B13']);
  });

  it('should return default batteries when input is an empty array', () => {
    const result = validateBatteryIds([]);
    expect(result).toEqual(['B10', 'B11', 'B12', 'B13']);
  });

  it('should return the same IDs for valid battery IDs', () => {
    const input = ['B10', 'B12'];
    const result = validateBatteryIds(input);
    expect(result).toEqual(['B10', 'B12']);
  });

  it('should remove duplicate battery IDs', () => {
    const input = ['B10', 'B11', 'B10', 'B13', 'B11'];
    const result = validateBatteryIds(input);
    expect(result).toEqual(['B10', 'B11', 'B13']);
  });

  it('should throw an error for invalid battery IDs', () => {
    const input = ['B10', 'B99', 'B14'];
    expect(() => validateBatteryIds(input)).toThrow('Invalid battery IDs: B99, B14');
  });

  it('should throw an error for malformed battery IDs', () => {
    const input = ['B1', '10', 'B100'];
    expect(() => validateBatteryIds(input)).toThrow('Invalid battery IDs: B1, 10, B100');
  });
});
