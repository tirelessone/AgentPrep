import { describe, expect, it } from 'vitest';

import { getRuntimePlatform, getTutorAvailability, resolveAppAsset } from './runtime';

describe('desktop runtime', () => {
  it('uses an explicit Vite desktop mode instead of an undocumented global', () => {
    expect(getRuntimePlatform('desktop')).toBe('desktop');
    expect(getRuntimePlatform('production')).toBe('web');
    expect(getRuntimePlatform('e2e')).toBe('web');
  });

  it('disables Tutor in desktop development and production', () => {
    expect(getTutorAvailability('desktop', true, 'desktop')).toBe('desktop-disabled');
    expect(getTutorAvailability('desktop', false, 'desktop')).toBe('desktop-disabled');
    expect(getTutorAvailability('web', true, 'development')).toBe('enabled');
    expect(getTutorAvailability('web', false, 'production')).toBe('deployment-disabled');
  });

  it('resolves packaged assets relative to the Tauri application root', () => {
    expect(resolveAppAsset('/content/original-v2.json', './', 'tauri://localhost/index.html')).toBe(
      'tauri://localhost/content/original-v2.json',
    );
    expect(resolveAppAsset('/question-assets/example.png', '/', 'https://agentprep.example/')).toBe(
      'https://agentprep.example/question-assets/example.png',
    );
    expect(resolveAppAsset('https://example.com/image.png', './', 'tauri://localhost/')).toBe(
      'https://example.com/image.png',
    );
  });
});
