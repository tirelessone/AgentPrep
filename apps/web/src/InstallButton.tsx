import { useEffect, useState } from 'react';

import { runtimePlatform, type RuntimePlatform } from './runtime';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallButton({ platform = runtimePlatform }: { platform?: RuntimePlatform }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent>();

  useEffect(() => {
    if (platform === 'desktop') return;
    const capture = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const installed = () => setPromptEvent(undefined);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, [platform]);

  if (platform === 'desktop' || !promptEvent) return null;

  return (
    <button
      className="install-button"
      onClick={async () => {
        await promptEvent.prompt();
        await promptEvent.userChoice;
        setPromptEvent(undefined);
      }}
    >
      安装应用
    </button>
  );
}
