export type RuntimePlatform = 'web' | 'desktop';

export function getRuntimePlatform(mode: string): RuntimePlatform {
  return mode === 'desktop' ? 'desktop' : 'web';
}

export const runtimePlatform = getRuntimePlatform(import.meta.env.MODE);

export function resolveAppAsset(
  pathname: string,
  baseUrl = import.meta.env.BASE_URL,
  currentHref = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
) {
  if (/^[a-z][a-z\d+.-]*:/i.test(pathname) || pathname.startsWith('//')) return pathname;
  const relativePath = pathname.replace(/^\/+/, '');
  return new URL(relativePath, new URL(baseUrl, currentHref)).toString();
}

export type TutorAvailability = 'enabled' | 'desktop-disabled' | 'deployment-disabled';

export function getTutorAvailability(
  platform: RuntimePlatform,
  development: boolean,
  mode: string,
): TutorAvailability {
  if (platform === 'desktop') return 'desktop-disabled';
  return development || mode === 'e2e' ? 'enabled' : 'deployment-disabled';
}
