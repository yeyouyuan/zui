import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const axeSource = readFileSync(
  new URL('../packages/ui/node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
);
async function open(page: Page) {
  await page.goto('/#/collaboration');
  await expect(page.getByRole('heading', { level: 1, name: '内容协作实验室' })).toBeVisible();
  await expect(page.locator('.collaboration-intro .doc-lead')).toHaveText(
    '在线预览和修改 Word、Excel、PDF 与文本，文件和讨论保存在本机。'
  );
  await expect(page.getByRole('region', { name: '本地文件工作台', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: '工作区保存状态', exact: true })).toHaveText(
    '已保存到本机'
  );
}

async function expectAccessible(page: Page) {
  const violations = await page.locator('.doc-main').evaluate(async (main) => {
    const { violations } = await (
      window as unknown as { axe: { run(root: Element): Promise<{ violations: unknown[] }> } }
    ).axe.run(main);
    return violations;
  });
  expect(violations).toEqual([]);
}

test('预览 → 编辑 → 段落评论 → 回复 → 解决与重新打开', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page
    .getByRole('navigation', { name: '文档大纲', exact: true })
    .getByRole('button', { name: '项目目标', exact: true })
    .click();
  await expect(page.locator('.collaboration-document section[data-active]')).toBeFocused();
  await expect(page.locator('.collaboration-document section[data-active]')).toContainText(
    '项目目标'
  );
  await page.getByRole('button', { name: '编辑文本', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '编辑项目概述', exact: true });
  await expect(editor).toBeFocused();
  await editor.fill('先完成文件预览，再完善段落评论。');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑文本', exact: true })).toBeFocused();
  await expect(page.getByText('先完成文件预览，再完善段落评论。', { exact: true })).toBeVisible();
  await expect(page.getByText(/^版本 v1\.3 · 纯文本/)).toBeVisible();
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
  await expect(page.getByRole('button', { name: '未解决', exact: true })).toBeFocused();
  await page.getByRole('button', { name: /^全部 \d/ }).click();
  await thread.getByRole('button', { name: '重新打开', exact: true }).click();
  await page.getByRole('button', { name: '未解决', exact: true }).click();
  await expect(thread).toBeVisible();
});

test('草稿取消、文件隔离、真实图片失败重试和只读权限', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '编辑文本', exact: true }).click();
  await page.getByRole('textbox', { name: '编辑项目概述', exact: true }).fill('未保存的内容');
  await expect(page.getByRole('button', { name: /^封面设计\.svg/ })).toBeDisabled();
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await expect(page.getByText('未保存的内容', { exact: true })).toHaveCount(0);
  const files = page.getByRole('navigation', { name: '协作文件', exact: true });
  await files.getByRole('button', { name: /^封面设计\.svg/ }).click();
  await expect(page.locator('.collaboration-figure img')).toBeVisible();
  await expect(page.getByRole('article', { name: '林岸的讨论', exact: true })).toHaveCount(0);
  await page.getByLabel('导入本地文件', { exact: true }).setInputFiles({
    name: '损坏图片.png',
    mimeType: 'image/png',
    buffer: Buffer.from('invalid-image'),
  });
  await expect(page.getByRole('alert')).toContainText('图片内容无法解码');
  await page.getByRole('button', { name: '重试预览', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('图片内容无法解码');
  await files.getByRole('button', { name: /^项目归档\.zip/ }).click();
  await expect(page.getByText('此文件类型暂不支持预览', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '下载附件', exact: true })).toBeEnabled();
  await files.getByRole('button', { name: /^项目方案\.txt/ }).click();
  await page.getByText('工作区设置', { exact: true }).click();
  await page.getByLabel('访问权限', { exact: true }).selectOption('read');
  await expect(page.getByRole('button', { name: '编辑文本', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: '评论当前文件', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '解决讨论', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '导入文件', exact: true })).toBeDisabled();
});

for (const width of [1440, 1280, 768, 320]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`协作工作台布局与无障碍 ${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1100 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await open(page);
      await expect(page.locator('.doc-main')).toHaveClass(/doc-main--wide/);
      expect(
        await page
          .locator('.collaboration-workspace')
          .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
      ).toBe(width === 1440 ? 3 : width === 1280 ? 2 : 1);
      for (const selector of [
        '.doc-main',
        '.collaboration-workspace',
        '.collaboration-document',
        '.collaboration-comments',
      ]) {
        expect(
          await page
            .locator(selector)
            .evaluate((element) => element.scrollWidth - element.clientWidth),
          selector
        ).toBeLessThanOrEqual(1);
      }
      await page.addScriptTag({ content: axeSource });
      await expectAccessible(page);
      await page.screenshot({ path: testInfo.outputPath('collaboration-first-screen.png') });
      const workspaceHeight = await page
        .locator('.collaboration-workspace')
        .evaluate((element) => element.getBoundingClientRect().height);
      await page.setViewportSize({ width, height: Math.ceil(workspaceHeight) + 160 });
      await page
        .locator('.collaboration-workspace')
        .screenshot({ path: testInfo.outputPath('collaboration-workspace.png') });
      await page.setViewportSize({ width, height: 1100 });
      await page.getByRole('button', { name: '针对项目概述讨论', exact: true }).click();
      await expect(
        page.getByRole('textbox', { name: '评论：项目概述', exact: true })
      ).toBeFocused();
      await expect(page.locator('.collaboration-composer-context')).toContainText(
        '关联段落 · 项目概述'
      );
      await expect(page.locator('.collaboration-composer-context blockquote')).toContainText(
        '让文件、修改与讨论留在同一个工作空间。'
      );
      await page
        .getByRole('textbox', { name: '评论：项目概述', exact: true })
        .fill('建议补充评审流程。');
      await expectAccessible(page);
      const contextHeight = await page
        .locator('.collaboration-workspace')
        .evaluate((element) => element.getBoundingClientRect().height);
      await page.setViewportSize({ width, height: Math.ceil(contextHeight) + 160 });
      await page.locator('.collaboration-workspace').screenshot({
        path: testInfo.outputPath('collaboration-comment-context.png'),
      });
      await page.setViewportSize({ width, height: 1100 });
      await page.getByRole('button', { name: '取消定位', exact: true }).click();
      await expect(page.getByRole('textbox', { name: '评论当前文件', exact: true })).toBeFocused();
      await page.getByText('工作区设置', { exact: true }).click();
      await expect(page.getByLabel('访问权限', { exact: true })).toBeVisible();
      expect(
        await page
          .locator('.doc-main')
          .evaluate((element) => element.scrollWidth - element.clientWidth)
      ).toBeLessThanOrEqual(1);
      await page.getByText('工作区设置', { exact: true }).click();
      await expect(page.getByLabel('访问权限', { exact: true })).toBeHidden();
      await page.getByRole('button', { name: '编辑文本', exact: true }).click();
      await expect(page.getByRole('textbox', { name: '编辑项目概述', exact: true })).toBeFocused();
      await expectAccessible(page);
      expect(
        await page
          .locator('.doc-main')
          .evaluate((element) => element.scrollWidth - element.clientWidth)
      ).toBeLessThanOrEqual(1);
      const editingHeight = await page
        .locator('.collaboration-workspace')
        .evaluate((element) => element.getBoundingClientRect().height);
      await page.setViewportSize({ width, height: Math.ceil(editingHeight) + 160 });
      await page.locator('.collaboration-workspace').screenshot({
        path: testInfo.outputPath('collaboration-editor.png'),
      });
    });
  }
}

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
  await expectAccessible(page);
});

test('浏览目录和引用不改变评论对象，段落草稿与文件草稿各自保留', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  const fileComment = page.getByRole('textbox', { name: '评论当前文件', exact: true });
  await fileComment.fill('整份方案的待发送意见。');
  await page
    .getByRole('navigation', { name: '文档大纲', exact: true })
    .getByRole('button', { name: '项目目标', exact: true })
    .click();
  await expect(fileComment).toHaveValue('整份方案的待发送意见。');
  await expect(page.locator('.collaboration-composer-context')).toHaveCount(0);
  await page.getByRole('button', { name: '针对项目概述讨论', exact: true }).click();
  const paragraphComment = page.getByRole('textbox', { name: '评论：项目概述', exact: true });
  await expect(paragraphComment).toHaveValue('');
  await paragraphComment.fill('概述段落的待发送意见。');
  await page.getByRole('button', { name: /^定位到项目目标：/ }).click();
  await expect(paragraphComment).toHaveValue('概述段落的待发送意见。');
  await page
    .getByRole('navigation', { name: '协作文件', exact: true })
    .getByRole('button')
    .first()
    .click();
  await expect(paragraphComment).toHaveValue('概述段落的待发送意见。');
  await page.getByRole('button', { name: '取消定位', exact: true }).click();
  await expect(fileComment).toHaveValue('整份方案的待发送意见。');
  await page.getByRole('button', { name: '针对项目概述讨论', exact: true }).click();
  await expect(paragraphComment).toHaveValue('概述段落的待发送意见。');
  await paragraphComment.press('Control+Enter');
  const thread = page.getByRole('article', { name: '你的讨论', exact: true });
  await expect(thread).toContainText('概述段落的待发送意见。');
  await expect(thread).toContainText('项目概述');
  await expect(fileComment).toHaveValue('整份方案的待发送意见。');
  await expect(fileComment).toBeFocused();
});

test('切换文件、回复和只读模式保留草稿，刷新后仍可恢复', async ({ page }) => {
  await open(page);
  const files = page.getByRole('navigation', { name: '协作文件', exact: true }).getByRole('button');
  const fileComment = page.getByRole('textbox', { name: '评论当前文件', exact: true });
  await fileComment.fill('方案文件草稿。');
  await files.nth(1).click();
  await expect(fileComment).toHaveValue('');
  await fileComment.fill('封面图片草稿。');
  await files.first().click();
  await expect(fileComment).toHaveValue('方案文件草稿。');
  await expect(files.first().getByRole('img', { name: '有未发送的草稿', exact: true })).toHaveCount(
    1
  );
  const thread = page.getByRole('article', { name: '林岸的讨论', exact: true });
  await thread.getByRole('button', { name: '回复', exact: true }).click();
  const reply = page.getByRole('textbox', { name: '回复林岸', exact: true });
  await reply.fill('回复的待发送草稿。');
  await page.getByRole('button', { name: '取消回复', exact: true }).click();
  await expect(fileComment).toHaveValue('方案文件草稿。');
  await thread.getByRole('button', { name: '回复', exact: true }).click();
  await expect(reply).toHaveValue('回复的待发送草稿。');
  await files.nth(1).click();
  await expect(fileComment).toHaveValue('封面图片草稿。');
  await files.first().click();
  await expect(reply).toHaveValue('回复的待发送草稿。');
  await page.getByText('工作区设置', { exact: true }).click();
  await page.getByLabel('访问权限', { exact: true }).selectOption('read');
  await expect(reply).toBeDisabled();
  await expect(reply).toHaveValue('回复的待发送草稿。');
  await page.getByLabel('访问权限', { exact: true }).selectOption('edit');
  await reply.press('Control+Enter');
  await expect(thread).toContainText('回复的待发送草稿。');
  await expect(fileComment).toHaveValue('方案文件草稿。');
  await expect(page.getByRole('article', { name: '你的讨论', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status', { name: '工作区保存状态', exact: true })).toHaveText(
    '已保存到本机'
  );
  await page.reload();
  await expect(fileComment).toHaveValue('方案文件草稿。');
  await expect(thread).toContainText('回复的待发送草稿。');
});

test('旧评论保留引用版本和原文，定位进入修改后的段落', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await open(page);
  await page.getByRole('button', { name: '针对项目概述讨论', exact: true }).click();
  await page
    .getByRole('textbox', { name: '评论：项目概述', exact: true })
    .fill('请补充评审负责人。');
  await page.getByRole('button', { name: '发送评论', exact: true }).click();
  const thread = page.getByRole('article', { name: '你的讨论', exact: true });
  const original = await thread.locator('.collaboration-quote').textContent();
  await page.getByRole('button', { name: '编辑文本', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '编辑项目概述', exact: true });
  await editor.fill('评审负责人负责整理各方反馈，并跟踪方案修改。');
  await editor.press('Control+Enter');
  await expect(thread.locator('.collaboration-quote')).toHaveText(original!);
  await expect(thread).toContainText('引用 v1.2');
  await expect(thread).toContainText('内容已更新');
  await expect(page.getByRole('article', { name: '林岸的讨论', exact: true })).not.toContainText(
    '内容已更新'
  );
  await thread.getByRole('button', { name: /^定位到项目概述：/ }).click();
  const current = page.locator('.collaboration-document section[data-active]');
  await expect(current).toBeFocused();
  await expect(current).toContainText('评审负责人负责整理各方反馈');
  await expect(page.getByRole('textbox', { name: '评论当前文件', exact: true })).toHaveValue('');
  await page.addScriptTag({ content: axeSource });
  await expectAccessible(page);
  const height = await page
    .locator('.collaboration-workspace')
    .evaluate((element) => element.getBoundingClientRect().height);
  await page.setViewportSize({ width: 1440, height: Math.ceil(height) + 160 });
  await page
    .locator('.collaboration-workspace')
    .screenshot({ path: testInfo.outputPath('collaboration-updated-quote.png') });
});

test('工作区设置支持 Escape 与点击外部收起，评论署名持久保存', async ({ page }) => {
  await open(page);
  const settings = page.locator('.collaboration-settings');
  const trigger = page.getByText('工作区设置', { exact: true });
  await trigger.click();
  await page.getByLabel('评论署名', { exact: true }).fill('本地作者');
  await page.getByLabel('评论署名', { exact: true }).press('Escape');
  await expect(settings).not.toHaveAttribute('open');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: /^定位到项目目标：/ }).click();
  await expect(settings).not.toHaveAttribute('open');
  await expect(page.locator('.collaboration-document section[data-active]')).toBeFocused();
  await expect(page.getByRole('status', { name: '工作区保存状态', exact: true })).toHaveText(
    '已保存到本机'
  );
  await page.reload();
  await page.getByText('工作区设置', { exact: true }).click();
  await expect(page.getByLabel('评论署名', { exact: true })).toHaveValue('本地作者');
});

test('评论快捷键避开输入法组合事件，发送后保留输入焦点', async ({ page }) => {
  await open(page);
  const comment = page.getByRole('textbox', { name: '评论当前文件', exact: true });
  await comment.fill('仍在输入法组合中的意见。');
  await comment.dispatchEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true });
  await expect(page.getByRole('article', { name: '你的讨论', exact: true })).toHaveCount(0);
  await expect(comment).toHaveValue('仍在输入法组合中的意见。');
  await comment.press('Control+Enter');
  await expect(page.getByRole('article', { name: '你的讨论', exact: true })).toContainText(
    '仍在输入法组合中的意见。'
  );
  await expect(comment).toHaveValue('');
  await expect(comment).toBeFocused();
});

async function saved(page: Page) {
  await expect(page.getByRole('status', { name: '工作区保存状态', exact: true })).toHaveText(
    '已保存到本机'
  );
}
async function downloaded(
  page: Page,
  button: string,
  within: Page | Locator = page
): Promise<Buffer> {
  const pending = page.waitForEvent('download');
  if (button === '下载文件') {
    // 下载文件入口在编辑器「文件」菜单内，菜单内容通过 Portal 渲染在 body 上。
    await within.getByRole('button', { name: '文件', exact: true }).click();
    await page.getByRole('menuitem', { name: '下载文件', exact: true }).click();
  } else {
    await within.getByRole('button', { name: button, exact: true }).click();
  }
  const download = await pending;
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFileSync(path!);
}

test('真实 UTF-8 文件导入、完整编辑、下载与关闭页面后的恢复', async ({
  page,
  context,
}, testInfo) => {
  await open(page);
  const original = Buffer.from('\ufeff第一行\r\n\r\n第二段 <script>不执行</script>\r\n');
  await page
    .getByLabel('导入本地文件', { exact: true })
    .setInputFiles({ name: '自己的笔记.md', mimeType: 'text/markdown', buffer: original });
  await expect(
    page.getByRole('heading', { level: 2, name: '自己的笔记.md', exact: true })
  ).toBeVisible();
  expect(await downloaded(page, '下载文件')).toEqual(original);
  const content = '完整修改后的第一段。\n\n第二段也可以编辑。\n  保留缩进和空行。\n';
  await page.getByRole('button', { name: '编辑文本', exact: true }).click();
  await page.getByRole('textbox', { name: '编辑正文', exact: true }).fill(content);
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByRole('button', { name: '针对正文讨论', exact: true }).click();
  await page
    .getByRole('textbox', { name: '评论：正文', exact: true })
    .fill('这是对我自己的文件的评审意见。');
  await page.getByRole('button', { name: '发送评论', exact: true }).click();
  await saved(page);
  const output = await downloaded(page, '下载文件');
  expect(output.toString('utf8')).toBe('\ufeff' + content);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.locator('.collaboration-workspace').screenshot({
    path: testInfo.outputPath('real-file-workspace.png'),
  });
  await page.close();
  const reopened = await context.newPage();
  await open(reopened);
  await expect(reopened.locator('.collaboration-block-body')).toHaveText(content);
  await expect(reopened.getByRole('article', { name: '你的讨论', exact: true })).toContainText(
    '这是对我自己的文件的评审意见。'
  );
  expect(await downloaded(reopened, '下载文件')).toEqual(output);
  await reopened.close();
});

test('每个章节均可编辑，正文与评论草稿刷新后可以继续', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '编辑项目目标', exact: true }).click();
  await page
    .getByRole('textbox', { name: '编辑项目目标', exact: true })
    .fill('这是第二个章节的完整修改。');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByRole('button', { name: '编辑交付范围', exact: true }).click();
  await page
    .getByRole('textbox', { name: '编辑交付范围', exact: true })
    .fill('尚未确认的第三章草稿。');
  await page.getByRole('button', { name: '暂存并退出', exact: true }).click();
  await page
    .getByRole('textbox', { name: '评论当前文件', exact: true })
    .fill('还没有发送的文件评论。');
  await saved(page);
  await page.reload();
  await expect(page.locator('.collaboration-document')).toContainText('这是第二个章节的完整修改。');
  await expect(page.getByRole('textbox', { name: '评论当前文件', exact: true })).toHaveValue(
    '还没有发送的文件评论。'
  );
  await page.getByRole('button', { name: '继续编辑草稿', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '编辑交付范围', exact: true })).toHaveValue(
    '尚未确认的第三章草稿。'
  );
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await saved(page);
  await page.reload();
  await expect(page.locator('.collaboration-document')).toContainText('尚未确认的第三章草稿。');
});

test('新建、重命名、搜索、空正文保存、删除与空工作区恢复', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '新建文档', exact: true }).click();
  await page.getByRole('textbox', { name: '文件名', exact: true }).fill('我的第一份文档.txt');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: '我的第一份文档.txt', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '编辑文本', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '编辑正文', exact: true });
  await editor.fill('稍后清空。');
  await editor.fill('');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  expect((await downloaded(page, '下载文件')).length).toBe(0);
  await page.getByRole('button', { name: '重命名文件', exact: true }).click();
  await page.getByRole('textbox', { name: '文件名', exact: true }).fill('更新后的名称.txt');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索工作区文件', exact: true }).fill('更新后');
  const files = page.getByRole('navigation', { name: '协作文件', exact: true });
  await expect(files.getByRole('button')).toHaveCount(1);
  await expect(files).toContainText('更新后的名称.txt');
  await page.getByRole('searchbox', { name: '搜索工作区文件', exact: true }).clear();
  await page.getByRole('button', { name: '删除文件', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(files.getByRole('button')).toHaveCount(4);
  for (let count = 4; count > 0; count--) {
    await page.getByRole('button', { name: '删除文件', exact: true }).click();
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(files.getByRole('button')).toHaveCount(count - 1);
  }
  await saved(page);
  await page.reload();
  await expect(page.getByText('开始你的第一份内容', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '评论当前文件', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '新建文档', exact: true }).click();
  await page.getByRole('textbox', { name: '文件名', exact: true }).fill('重新开始.txt');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(files.getByRole('button')).toHaveCount(1);
});

test('工作区备份可在新浏览器会话恢复文件、附件、评论、回复与草稿', async ({ page, browser }) => {
  await open(page);
  await page.getByLabel('导入本地文件', { exact: true }).setInputFiles({
    name: '备份验证.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('需要迁移的正文。'),
  });
  await page.getByRole('button', { name: '针对正文讨论', exact: true }).click();
  await page.getByRole('textbox', { name: '评论：正文', exact: true }).fill('需要迁移的评论。');
  await page.getByRole('button', { name: '发送评论', exact: true }).click();
  const thread = page.getByRole('article', { name: '你的讨论', exact: true });
  await thread.getByRole('button', { name: '回复', exact: true }).click();
  await page.getByRole('textbox', { name: '回复你', exact: true }).fill('需要迁移的回复。');
  await page.getByRole('button', { name: '发送回复', exact: true }).click();
  await page.getByRole('textbox', { name: '评论当前文件', exact: true }).fill('需要迁移的草稿。');
  await saved(page);
  await page.getByText('工作区设置', { exact: true }).click();
  const backup = await downloaded(page, '导出工作区备份');
  const clean = await browser.newContext();
  try {
    const restored = await clean.newPage();
    await open(restored);
    await restored
      .getByLabel('导入工作区备份文件', { exact: true })
      .setInputFiles({ name: 'workspace.zui.json', mimeType: 'application/json', buffer: backup });
    const files = restored.getByRole('navigation', { name: '协作文件', exact: true });
    await expect(files.getByRole('button')).toHaveCount(7); // Original 3 + 4 restored copies.
    await files.getByRole('button', { name: /^备份验证\.txt/ }).click();
    await expect(restored.locator('.collaboration-document')).toContainText('需要迁移的正文。');
    const restoredThread = restored.getByRole('article', { name: '你的讨论', exact: true });
    await expect(restoredThread).toContainText('需要迁移的评论。');
    await expect(restoredThread).toContainText('需要迁移的回复。');
    await expect(restored.getByRole('textbox', { name: '评论当前文件', exact: true })).toHaveValue(
      '需要迁移的草稿。'
    );
    await saved(restored);
    await restored.reload();
    await files
      .getByRole('button', { name: /^封面设计\.svg/ })
      .last()
      .click();
    await expect(restored.locator('.collaboration-figure img')).toBeVisible();
    expect(
      await restored
        .locator('.collaboration-figure img')
        .evaluate((image) => (image as HTMLImageElement).naturalWidth)
    ).toBeGreaterThan(0);
    expect((await downloaded(restored, '下载文件')).toString()).toContain('<svg');
    await restored.getByRole('button', { name: '下载文件', exact: true }).hover();
    await restored.addScriptTag({ content: axeSource });
    await expectAccessible(restored);
  } finally {
    await clean.close();
  }
});

test('不合法备份、错误编码、超大文件与图片失败不破坏现有文件', async ({ page }) => {
  await open(page);
  const files = page.getByRole('navigation', { name: '协作文件', exact: true });
  await page.getByLabel('导入工作区备份文件', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"unknown"}'),
  });
  await expect(page.getByRole('alert')).toContainText('不是受支持的工作台备份');
  await expect(files.getByRole('button')).toHaveCount(3);
  await page.getByLabel('导入本地文件', { exact: true }).setInputFiles([
    { name: '正常.txt', mimeType: 'text/plain', buffer: Buffer.from('成功导入的文件。') },
    { name: '错误编码.txt', mimeType: 'text/plain', buffer: Buffer.from([0xff, 0xfe, 0xff]) },
    {
      name: '过大.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(21 * 1024 * 1024),
    },
    { name: '伪造.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') },
  ]);
  await expect(page.getByRole('alert')).toContainText('不是 UTF-8');
  await expect(page.getByRole('alert')).toContainText('20 MB');
  await expect(page.getByRole('alert')).toContainText('PDF 文件头');
  await expect(files.getByRole('button')).toHaveCount(4);
  await expect(page.locator('.collaboration-document')).toContainText('成功导入的文件。');
  await saved(page);
  await page.reload();
  await expect(files.getByRole('button')).toHaveCount(4);
});

test('保存失败不会误报成功，正文和评论仍可导出，重试后恢复持久保存', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    const state = window as unknown as { failWorkspaceWrites: boolean };
    state.failWorkspaceWrites = true;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'workspace' && state.failWorkspaceWrites)
        throw new DOMException('Test quota exceeded', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '编辑项目目标', exact: true }).click();
  await page
    .getByRole('textbox', { name: '编辑项目目标', exact: true })
    .fill('即使存储失败，这份正文也不会被清掉。');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('status', { name: '工作区保存状态', exact: true })).toHaveText(
    '保存失败'
  );
  await expect(page.getByRole('alert')).toContainText('Test quota exceeded');
  expect((await downloaded(page, '下载文件')).toString()).toContain(
    '即使存储失败，这份正文也不会被清掉。'
  );
  await page
    .getByRole('textbox', { name: '评论当前文件', exact: true })
    .fill('保留在失败状态下的评论。');
  await page.getByRole('button', { name: '发送评论', exact: true }).click();
  await expect(page.getByRole('article', { name: '你的讨论', exact: true })).toContainText(
    '保留在失败状态下的评论。'
  );
  const backup = JSON.parse((await downloaded(page, '导出当前备份')).toString());
  expect(
    backup.data.threads.some(
      (thread: { body: string }) => thread.body === '保留在失败状态下的评论。'
    )
  ).toBe(true);
  await page.evaluate(() => {
    (window as unknown as { failWorkspaceWrites: boolean }).failWorkspaceWrites = false;
  });
  await page.getByRole('button', { name: '重试保存', exact: true }).click();
  await saved(page);
  await page.reload();
  await expect(page.locator('.collaboration-document')).toContainText(
    '即使存储失败，这份正文也不会被清掉。'
  );
  await expect(page.getByRole('article', { name: '你的讨论', exact: true })).toContainText(
    '保留在失败状态下的评论。'
  );
});

test('两个标签页的旧版本不会覆盖新版本，冲突副本可备份', async ({ page, context }) => {
  await open(page);
  const stale = await context.newPage();
  await stale.addInitScript(() => {
    Object.defineProperty(window, 'BroadcastChannel', { value: undefined });
  });
  await open(stale);
  await page.getByRole('button', { name: '编辑项目目标', exact: true }).click();
  await page
    .getByRole('textbox', { name: '编辑项目目标', exact: true })
    .fill('另一标签页已经保存的新内容。');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await saved(page);
  await stale
    .getByRole('textbox', { name: '评论当前文件', exact: true })
    .fill('旧标签页还没有保存的评论。');
  await expect(stale.getByRole('status', { name: '工作区保存状态', exact: true })).toHaveText(
    '发现版本冲突'
  );
  await expect(stale.getByRole('alert')).toContainText('另一个标签页已经更新');
  const backup = JSON.parse((await downloaded(stale, '导出当前备份')).toString());
  expect(Object.values(backup.data.commentDrafts)).toContain('旧标签页还没有保存的评论。');
  await stale.getByRole('button', { name: '载入最新版本', exact: true }).click();
  await stale.getByRole('button', { name: '确认载入', exact: true }).click();
  await saved(stale);
  await expect(stale.locator('.collaboration-document')).toContainText(
    '另一标签页已经保存的新内容。'
  );
  await expect(stale.getByRole('article', { name: '你的讨论', exact: true })).toHaveCount(0);
  await stale.close();
});

function pdfFixture(): Buffer {
  let pdf = '%PDF-1.4\n';
  const stream = 'BT /F1 16 Tf 40 100 Td (Local workspace PDF) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test('宿主回退集成：文档服务不可用时 PDF 与二进制附件仍可下载，原件刷新后不变', async ({
  page,
}) => {
  let sessionRequests = 0;
  await page.route('**/api/office/**', async (route) => {
    const health = new URL(route.request().url()).pathname === '/api/office/health';
    if (!health) sessionRequests++;
    await route.fulfill({
      status: health ? 200 : 503,
      contentType: 'application/json',
      body: JSON.stringify(
        health
          ? {
              available: false,
              documentServerUrl: 'http://127.0.0.1:8082',
              error: '测试文档服务暂不可用。',
            }
          : { error: '文档服务不可用时不应创建编辑会话。' }
      ),
    });
  });
  await open(page);
  const pdf = pdfFixture();
  const binary = Buffer.from([0, 255, 128, 65, 32, 0, 10]);
  await page.getByLabel('导入本地文件', { exact: true }).setInputFiles([
    { name: '阅读文件.pdf', mimeType: 'application/pdf', buffer: pdf },
    { name: '附件.bin', mimeType: 'application/octet-stream', buffer: binary },
  ]);
  const editor = page.getByRole('region', { name: '阅读文件.pdf 在线编辑器', exact: true });
  await expect(editor).toBeVisible();
  await expect(
    editor.getByRole('heading', { name: '完整文档编辑器尚未连接', exact: true })
  ).toBeVisible();
  await expect(editor.getByRole('alert')).toContainText('测试文档服务暂不可用。');
  await expect(editor.getByRole('button', { name: '保存到工作台', exact: true })).toBeDisabled();
  await expect(editor.locator('iframe')).toHaveCount(0);
  expect(await downloaded(page, '下载文件', editor)).toEqual(pdf);
  await saved(page);
  await page.reload();
  await expect(
    editor.getByRole('heading', { name: '完整文档编辑器尚未连接', exact: true })
  ).toBeVisible();
  expect(await downloaded(page, '下载文件', editor)).toEqual(pdf);
  expect(sessionRequests).toBe(0);
  await editor.getByRole('button', { name: '返回工作台', exact: true }).click();
  const files = page.getByRole('navigation', { name: '协作文件', exact: true });
  await files.getByRole('button', { name: /^附件\.bin/ }).click();
  await expect(page.getByText('此文件类型暂不支持预览', { exact: true })).toBeVisible();
  expect(await downloaded(page, '下载附件')).toEqual(binary);
  await page
    .getByRole('textbox', { name: '评论当前文件', exact: true })
    .fill('二进制附件也可以留下评审意见。');
  await page.getByRole('button', { name: '发送评论', exact: true }).click();
  await saved(page);
  await page.reload();
  await expect(page.getByRole('article', { name: '你的讨论', exact: true })).toContainText(
    '二进制附件也可以留下评审意见。'
  );
  expect(await downloaded(page, '下载附件')).toEqual(binary);
});
