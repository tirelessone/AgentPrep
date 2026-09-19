import { expect, test } from '@playwright/test';

test('keeps answers hidden until submission and persists wrong answers', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /开始刷题/ }).click();

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
