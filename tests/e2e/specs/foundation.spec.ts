import { expect, test } from '@playwright/test';

test('shows the Phase 0 local-first foundation on mobile', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /学 Agent/ })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('本地模式已就绪');
  await expect(page.getByText('AI 有边界')).toBeVisible();
});
