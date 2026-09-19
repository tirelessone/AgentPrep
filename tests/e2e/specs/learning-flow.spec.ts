import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function startAgentPractice(page: Page) {
  await page.getByRole('button', { name: /开始刷题/ }).click();
  await page.getByRole('button', { name: /Agent \/ RAG.*7 道题/ }).click();
  await page.getByRole('button', { name: /开始专项练习/ }).click();
}

test('keeps answers hidden until submission and persists wrong answers', async ({ page }) => {
  await page.goto('/');
  await startAgentPractice(page);

  await expect(page.getByRole('button', { name: '提交答案' })).toBeVisible();
  await expect(page.getByText(/模型只能提出结构化工具调用/)).toHaveCount(0);

  await page.locator('label.choice').filter({ hasText: '把系统提示词拼到用户消息前' }).click();
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByText('这次没答对')).toBeVisible();
  await expect(page.getByText(/模型只能提出结构化工具调用/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /错题回看 1 道待巩固/ })).toBeVisible();
});

test('loads the installed shell while offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: /把每次答错/ })).toBeVisible();
    await expect(
      page.getByRole('status', { name: '' }).filter({ hasText: '离线模式' }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('migrates a version 1 database without losing settings', async ({ page }) => {
  await page.goto('/icon.svg');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase('agentprep');
      deletion.onsuccess = () => resolve();
      deletion.onerror = () => reject(deletion.error);
    });

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('agentprep', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('settings', { keyPath: 'key' });
        store.createIndex('updatedAt', 'updatedAt');
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('settings', 'readwrite');
        transaction.objectStore('settings').put({
          key: 'legacy-theme',
          value: 'light',
          updatedAt: '2026-09-19T00:00:00.000Z',
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: /错题回看/ })).toBeVisible();

  const migrated = await page.evaluate(async () => {
    return new Promise<{ version: number; value?: unknown }>((resolve, reject) => {
      const request = indexedDB.open('agentprep');
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('settings', 'readonly');
        const get = transaction.objectStore('settings').get('legacy-theme');
        get.onsuccess = () => {
          resolve({ version: database.version, value: get.result?.value });
          database.close();
        };
        get.onerror = () => reject(get.error);
      };
      request.onerror = () => reject(request.error);
    });
  });

  // Dexie maps its logical version 2 to native IndexedDB version 20.
  expect(migrated).toEqual({ version: 20, value: 'light' });
});

test('shows Tutor only after submission and renders SSE output', async ({ page }) => {
  let tutorPayload: { context?: { submitted?: boolean; correctChoiceIds?: string[] } } = {};
  await page.route('**/api/tutor/stream', async (route) => {
    tutorPayload = route.request().postDataJSON() as typeof tutorPayload;
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'event: token\ndata: {"text":"面试时先说明工具调用边界。"}',
        'event: done\ndata: {}',
        '',
      ].join('\n\n'),
    });
  });

  await page.goto('/');
  await startAgentPractice(page);
  await expect(page.getByRole('heading', { name: 'AI Tutor' })).toHaveCount(0);
  await page.locator('label.choice').filter({ hasText: '受控执行器校验并执行工具调用' }).click();
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('heading', { name: 'AI Tutor' })).toBeVisible();
  await page.getByRole('button', { name: '询问 Tutor' }).click();
  await expect(page.getByText('面试时先说明工具调用边界。')).toBeVisible();
  expect(tutorPayload).toMatchObject({
    context: { submitted: true, correctChoiceIds: ['b'] },
  });
});

test('publishes install metadata and has no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  await expect(manifest.json()).resolves.toMatchObject({
    name: 'AgentPrep',
    display: 'standalone',
  });
  await page.evaluate(async () => navigator.serviceWorker.ready);

  const homeScan = await new AxeBuilder({ page }).analyze();
  expect(
    homeScan.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([]);

  await page.getByRole('button', { name: /开始刷题/ }).click();
  const selectionScan = await new AxeBuilder({ page }).analyze();
  expect(
    selectionScan.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([]);

  await page.getByRole('button', { name: /Agent \/ RAG.*7 道题/ }).click();
  await page.getByRole('button', { name: /开始专项练习/ }).click();
  const questionScan = await new AxeBuilder({ page }).analyze();
  expect(
    questionScan.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([]);
});

test('restores a validated backup and exports it again', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '数据' }).click();
  const backup = {
    schemaVersion: 1,
    exportedAt: '2026-09-19T12:00:00.000Z',
    data: {
      attempts: [],
      favorites: [{ questionId: 'agent-loop-001', createdAt: '2026-09-19T12:00:00.000Z' }],
      reviews: [],
      settings: [],
    },
  };
  await page.getByLabel('选择 AgentPrep 备份文件').setInputFiles({
    name: 'agentprep-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText('导入完成，当前设备的数据已恢复。')).toBeVisible();
  await expect(page.locator('.data-summary div').nth(1)).toContainText('1道收藏');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出学习数据' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^agentprep-backup-\d{4}-\d{2}-\d{2}\.json$/);
});
