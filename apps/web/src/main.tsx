import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { runtimePlatform } from './runtime';
import './styles.css';

if (runtimePlatform === 'web') {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

async function bootstrap() {
  const runtime =
    import.meta.env.MODE === 'e2e'
      ? (await import('./cloud/e2e-runtime')).createE2eCloudRuntime()
      : undefined;
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App runtime={runtime} />
    </React.StrictMode>,
  );
}

void bootstrap();
