import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function startAgentPractice(page: Page) {
  await page.getByRole('button', { name: /开始刷题/ }).click();
  await page.getByRole('button', { name: /Agent \/ RAG.*7 道题/ }).click();
  await page.getByLabel('顺序').click();
  await page.getByRole('button', { name: /开始专项练习/ }).click();
}

async function chooseNetworkPractice(page: Page, order: '随机' | '顺序') {
  await page.getByRole('button', { name: /开始刷题/ }).click();
  await page.getByRole('button', { name: /计算机网络.*521 道题/ }).click();
  await page.getByLabel('20', { exact: true }).click();
  await page.getByLabel(order, { exact: true }).click();
  await page.getByRole('button', { name: /开始专项练习/ }).click();
}

async function register(page: Page, email: string) {
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.getByRole('tab', { name: '注册' }).click();
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill('password123');
  await page.getByLabel('确认密码').fill('password123');
  await page.locator('.auth-form').getByRole('button', { name: '注册' }).click();
  await expect(page.getByRole('heading', { name: '账号与同步' })).toBeVisible();
}

async function login(page: Page, email: string) {
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill('password123');
  await page.locator('.auth-form').getByRole('button', { name: '登录' }).click();
  await expect(page.getByRole('heading', { name: '账号与同步' })).toBeVisible();
}

test('keeps answers hidden until submission and persists wrong answers', async ({ page }) => {
  await page.goto('/');
  await startAgentPractice(page);

  await expect(page.getByRole('button', { name: '提交答案' })).toBeVisible();
  await expect(page.getByText(/模型只能提出结构化工具调用/)).toHaveCount(0);

  await page
    .locator('label.choice')
    .filter({ hasText: '把系统提示词拼到用户消息前' })
    .locator('input')
    .check({ force: true });
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByText('这次没答对')).toBeVisible();
  await expect(page.getByText(/模型只能提出结构化工具调用/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /错题回看 1 道待巩固/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /今日复习 1 道已到期/ })).toBeVisible();
});

test('loads the installed shell while offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText(/当前共 529 道题/)).toBeVisible();
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
    await page.getByRole('button', { name: /开始刷题/ }).click();
    await expect(page.getByRole('button', { name: /计算机网络.*521 道题/ })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('syncs confirmed guest data, offline mutations, and isolates a second account', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(async () => navigator.serviceWorker.ready);

  await startAgentPractice(page);
  await page.getByRole('button', { name: '收藏题目' }).click();
  await page.locator('label.choice input').first().check({ force: true });
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.locator('.answer-panel')).toBeVisible();
  await page.getByRole('button', { name: '返回 AgentPrep 首页' }).click();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await register(page, 'alice@example.com');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByText('检测到本机学习记录')).toBeVisible();
  await page.getByRole('button', { name: '合并到我的账号' }).click();
  await expect(page.getByText('已同步').last()).toBeVisible();

  await context.setOffline(true);
  await page.getByRole('button', { name: '返回 AgentPrep 首页' }).click();
  await startAgentPractice(page);
  await page.locator('label.choice input').first().check({ force: true });
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.locator('.answer-panel')).toBeVisible();
  await page.getByRole('button', { name: '下一题' }).click();
  await page.getByRole('button', { name: '收藏题目' }).click();
  await page.locator('label.choice input').first().check({ force: true });
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.locator('.answer-panel')).toBeVisible();
  await page.reload();
  await expect(page.getByText('离线模式').last()).toBeVisible();
  await expect(page.getByRole('button', { name: /我的收藏 2 道已收藏/ })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText('已同步').last()).toBeVisible();

  const aliceId = await page.evaluate(() => {
    const session = localStorage.getItem('agentprep-e2e-session');
    return (JSON.parse(session!) as { id: string }).id;
  });
  await page.goto('/icon.svg');
  await page.evaluate(async (databaseName) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Account database deletion was blocked.'));
    });
  }, `agentprep-user-${aliceId}`);
  await page.goto('/');
  await expect(page.getByText('已同步').last()).toBeVisible();
  await expect(page.locator('.hero-metric')).toHaveAttribute('aria-label', '累计完成 3 次作答');
  await expect(page.getByRole('button', { name: /我的收藏 2 道已收藏/ })).toBeVisible();

  await page.getByRole('button', { name: 'alice@example.com' }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await page.getByRole('tab', { name: '注册' }).click();
  await page.getByLabel('邮箱').fill('bob@example.com');
  await page.getByLabel('密码', { exact: true }).fill('password123');
  await page.getByLabel('确认密码').fill('password123');
  await page.locator('.auth-form').getByRole('button', { name: '注册' }).click();
  await expect(page.getByText('检测到本机学习记录')).toBeVisible();
  await page.getByRole('button', { name: '暂不合并' }).click();
  await page.getByRole('button', { name: '返回 AgentPrep 首页' }).click();
  await expect(page.locator('.hero-metric')).toHaveAttribute('aria-label', '累计完成 0 次作答');

  await page.getByRole('button', { name: 'bob@example.com' }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await login(page, 'alice@example.com');
  await page.getByRole('button', { name: '返回 AgentPrep 首页' }).click();
  await expect(page.locator('.hero-metric')).toHaveAttribute('aria-label', '累计完成 3 次作答');
});

test('completes a fixed 20-question random network session on a 390px mobile viewport', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    let seed = 408;
    Math.random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return seed / 4_294_967_296;
    };
  });
  await page.goto('/');
  await chooseNetworkPractice(page, '随机');
  await expect(page.getByRole('heading', { name: '1 / 20' })).toBeVisible();

  const chapters = new Set<string>();
  for (let index = 0; index < 20; index += 1) {
    const chapter = await page.locator('.topic-row span').nth(1).textContent();
    if (chapter) chapters.add(chapter);
    if (index === 0) await page.getByRole('button', { name: '收藏题目' }).click();
    await page.locator('label.choice input').first().check({ force: true });
    await page.getByRole('button', { name: '提交答案' }).click();
    await expect(page.locator('.answer-panel')).toBeVisible();
    await expect(page.locator('.answer-panel p')).not.toBeEmpty();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: index === 19 ? '完成练习' : '下一题' }).click();
  }

  expect(chapters.size).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: /我的收藏 1 道已收藏/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /我的收藏 1 道已收藏/ })).toBeVisible();
  await page.getByRole('button', { name: /我的收藏 1 道已收藏/ }).click();
  await expect(page.getByRole('heading', { name: '1 / 1' })).toBeVisible();
  await page.getByRole('button', { name: '返回 AgentPrep 首页' }).click();
  await page.getByRole('button', { name: /开始刷题/ }).click();
  await page.getByRole('button', { name: /计算机网络.*521 道题/ }).click();
  await page.getByLabel('未做题').click();
  await page.getByLabel('顺序', { exact: true }).click();
  await page.getByRole('button', { name: /开始专项练习/ }).click();
  await expect(page.getByRole('heading', { name: '1 / 20' })).toBeVisible();
});

test('loads two real prompt images without blocking sequential practice', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await chooseNetworkPractice(page, '顺序');

  let loadedImages = 0;
  for (let index = 0; index < 10; index += 1) {
    const images = page.locator('.question-media img');
    const imageCount = await images.count();
    for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
      const image = images.nth(imageIndex);
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element) => element.complete)).toBe(true);
      expect(
        await image.evaluate(
          (element) =>
            element.naturalWidth > 0 && element.scrollWidth <= element.parentElement!.clientWidth,
        ),
      ).toBe(true);
      loadedImages += 1;
    }
    await page.locator('label.choice input').first().check({ force: true });
    await page.getByRole('button', { name: '提交答案' }).click();
    await expect(page.locator('.answer-panel')).toBeVisible();
    if (index < 9) await page.getByRole('button', { name: '下一题' }).click();
  }
  expect(loadedImages).toBeGreaterThanOrEqual(2);
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

  // Dexie maps its logical version 3 to native IndexedDB version 30.
  expect(migrated).toEqual({ version: 30, value: 'light' });
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
  await page
    .locator('label.choice')
    .filter({ hasText: '受控执行器校验并执行工具调用' })
    .locator('input')
    .check({ force: true });
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
    icons: expect.arrayContaining([
      expect.objectContaining({ src: 'icon-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: 'icon-512.png', sizes: '512x512' }),
    ]),
  });
  expect((await page.request.get('/icon-192.png')).ok()).toBe(true);
  expect((await page.request.get('/icon-512.png')).ok()).toBe(true);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/apple-touch-icon.png',
  );
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
