// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertWritable, DemoModeError, demoModeResponse } from './guard.ts';

describe('assertWritable', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws DemoModeError in demo mode', () => {
    vi.stubEnv('DEMO_MODE', 'true');
    expect(() => assertWritable()).toThrow(DemoModeError);
  });

  it('allows the write when demo mode is off or unset', () => {
    vi.stubEnv('DEMO_MODE', 'false');
    expect(() => assertWritable()).not.toThrow();
    vi.stubEnv('DEMO_MODE', undefined);
    expect(() => assertWritable()).not.toThrow();
  });

  it('reads the mode on every call', () => {
    vi.stubEnv('DEMO_MODE', 'false');
    expect(() => assertWritable()).not.toThrow();
    vi.stubEnv('DEMO_MODE', 'true');
    expect(() => assertWritable()).toThrow(DemoModeError);
  });

  it('fails on an invalid value instead of guessing', () => {
    vi.stubEnv('DEMO_MODE', 'yes');
    expect(() => assertWritable()).toThrow('DEMO_MODE');
  });
});

describe('demoModeResponse', () => {
  it('maps DemoModeError to a 403 JSON response', async () => {
    const response = demoModeResponse(new DemoModeError());
    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: 'This action is disabled in demo mode' });
  });

  it('leaves every other error to the caller', () => {
    expect(demoModeResponse(new Error('boom'))).toBeUndefined();
    expect(demoModeResponse('boom')).toBeUndefined();
  });

  it('gives the error a name a Server Action can match on', () => {
    expect(new DemoModeError().name).toBe('DemoModeError');
    expect(new DemoModeError()).toBeInstanceOf(Error);
  });
});
