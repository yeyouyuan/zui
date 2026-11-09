import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const axeSource = readFileSync(
  new URL('../packages/ui/node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
);
async function open(page: import('@playwright/test').Page) {
  await page.goto('/#/collaboration');
  await expect(page.getByRole('heading', { level: 1, name: '内容协作实验室' })).toBeVisible();
}

test('预览 → 编辑 → 段落评论 → 回复 → 解决与重新打开', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '编辑文本', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '编辑项目概述', exact: true });
  await expect(editor).toBeFocused();
  await editor.fill('先完成文件预览，再完善段落评论。');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByText('先完成文件预览，再完善段落评论。', { exact: true })).toBeVisible();
  await expect(page.getByText('版本 v1.3 · 纯文本', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '针对项目概述讨论', exact: true }).click();
  const comment = page.getByRole('textbox', { name: '评论：项目概述', exact: true });
  await expect(comment).toBeFocused();
  await comment.fill('这段需要补充验收标准。');
  await page.getByRole('button', { name: '发送评论', exact: true }).click();
  const thread = page.getByRole('article', { name: '你的讨论', exact: true });
  await expect(thread).toContainText('先完成文件预览，再完善段落评论。');
  await thread.getByRole('button', { name: /^定位到项目概述：/ }).click();
  await expect(page.locator('.collaboration-document section[data-active]')).toBeFocused();
  await thread.getByRole('button', { name: '回复', exact: true }).click();
  await page.getByRole('textbox', { name: '回复你', exact: true }).fill('已补充。');
  await page.getByRole('button', { name: '发送回复', exact: true }).click();
  await expect(thread).toContainText('已补充。');
  await thread.getByRole('button', { name: '解决讨论', exact: true }).click();
  await expect(thread).toHaveCount(0);
  await page.getByRole('button', { name: /^全部 \d/ }).click();
  await thread.getByRole('button', { name: '重新打开', exact: true }).click();
  await page.getByRole('button', { name: '未解决', exact: true }).click();
  await expect(thread).toBeVisible();
});

test('草稿取消、文件隔离、加载失败恢复和只读权限', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '编辑文本', exact: true }).click();
  await page.getByRole('textbox', { name: '编辑项目概述', exact: true }).fill('未保存的内容');
  await expect(page.getByRole('button', { name: '封面设计.svg', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await expect(page.getByText('未保存的内容', { exact: true })).toHaveCount(0);
  await page
    .getByRole('navigation', { name: '协作文件', exact: true })
    .getByRole('button')
    .nth(1)
    .click();
  await expect(page.locator('.collaboration-figure img')).toBeVisible();
  await expect(page.getByRole('article', { name: '林岸的讨论', exact: true })).toHaveCount(0);
  await page.getByLabel('预览状态（演示）', { exact: true }).selectOption('loading');
  await expect(page.getByRole('status', { name: '文件预览加载中', exact: true })).toBeVisible();
  await page.getByLabel('预览状态（演示）', { exact: true }).selectOption('error');
  await expect(page.getByRole('alert')).toContainText('文件暂时无法预览');
  await page.getByRole('button', { name: '重试预览', exact: true }).click();
  await expect(page.locator('.collaboration-figure img')).toBeVisible();
  await page
    .getByRole('navigation', { name: '协作文件', exact: true })
    .getByRole('button')
    .nth(2)
    .click();
  await expect(page.getByText('此文件类型暂不支持预览', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: '协作文件', exact: true })
    .getByRole('button')
    .first()
    .click();
  await page.getByLabel('访问权限', { exact: true }).selectOption('read');
  await expect(page.getByRole('button', { name: '编辑文本', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: '评论当前文件', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '解决讨论', exact: true })).toBeDisabled();
});

test('窄屏暗色：评论长文本、键盘焦点和无障碍语义', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await open(page);
  await page.getByRole('textbox', { name: '评论当前文件', exact: true }).fill('Content'.repeat(40));
  await page.getByRole('button', { name: '发送评论', exact: true }).click();
  expect(
    await page.locator('.doc-main').evaluate((main) => main.scrollWidth - main.clientWidth)
  ).toBeLessThanOrEqual(1);
  await page.addScriptTag({ content: axeSource });
  const violations = await page.locator('.doc-main').evaluate(async (main) => {
    const { violations } = await (
      window as unknown as { axe: { run(root: Element): Promise<{ violations: unknown[] }> } }
    ).axe.run(main);
    return violations;
  });
  expect(violations).toEqual([]);
});
