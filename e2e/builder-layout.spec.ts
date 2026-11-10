import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function loadPage(page: Page, content: unknown[]) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/builder');
  await expect(
    page.getByRole('heading', { level: 1, name: '页面搭建器', exact: true })
  ).toBeVisible();
  await expect(page.locator('#preview-frame')).toBeVisible();
  await page.getByLabel('导入页面或工作区 JSON', { exact: true }).setInputFiles({
    name: 'layout.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        root: { props: { title: '排版验证', theme: 'light', maxWidth: 1200, padding: 24 } },
        content,
      })
    ),
  });
  await expect(page.locator('.doc-builder-notice')).toContainText('已导入 1 个页面');
}

async function exportedHtml(page: Page) {
  const downloaded = page.waitForEvent('download');
  await page.locator('.studio-file-menu > summary').click();
  await page.getByRole('button', { name: '导出 HTML', exact: true }).click();
  return readFileSync((await (await downloaded).path())!, 'utf8');
}

test('编辑器排版：子组件百分比宽度在画布、手机和独立页面保持一致', async ({ page, context }) => {
  await loadPage(page, [
    {
      type: 'Container',
      props: {
        id: 'layout-container',
        _design: {
          desktop: { display: 'flex', flexDirection: 'row', gap: 0 },
          mobile: { flexDirection: 'column' },
        },
        content: [
          {
            type: 'Heading',
            props: {
              id: 'layout-title',
              text: '主标题',
              level: 'h2',
              align: 'left',
              _design: { desktop: { width: '50%' }, mobile: { width: '100%' } },
            },
          },
          {
            type: 'Heading',
            props: {
              id: 'layout-subtitle',
              text: '副标题',
              level: 'h2',
              align: 'left',
              _design: {
                desktop: { width: '100%', maxWidth: '50%' },
                mobile: { width: '100%', maxWidth: '100%' },
              },
            },
          },
        ],
      },
    },
  ]);
  const frame = page.frameLocator('#preview-frame');
  const title = frame.getByRole('heading', { name: '主标题', exact: true });
  const ratio = () =>
    title.evaluate(
      (node) =>
        node.getBoundingClientRect().width /
        node.closest('.z-builder-flex')!.getBoundingClientRect().width
    );
  await expect.poll(ratio).toBeCloseTo(0.5, 2);
  const subtitle = frame.getByRole('heading', { name: '副标题', exact: true });
  await expect
    .poll(() =>
      subtitle.evaluate(
        (node) =>
          node.getBoundingClientRect().width /
          node.closest('.z-builder-flex')!.getBoundingClientRect().width
      )
    )
    .toBeCloseTo(0.5, 2);
  await expect
    .poll(async () => {
      const [first, second] = await Promise.all([title.boundingBox(), subtitle.boundingBox()]);
      return first && second ? Math.abs(first.y - second.y) : Infinity;
    })
    .toBeLessThan(2);
  await page.getByRole('button', { name: '切换到手机画布', exact: true }).click();
  await expect.poll(ratio).toBeCloseTo(1, 2);
  await expect
    .poll(() =>
      subtitle.evaluate(
        (node) =>
          node.getBoundingClientRect().width /
          node.closest('.z-builder-flex')!.getBoundingClientRect().width
      )
    )
    .toBeCloseTo(1, 2);
  const html = await exportedHtml(page);
  const offline = await context.newPage();
  await offline.route('**/*', (route) => route.abort());
  await offline.setViewportSize({ width: 1280, height: 900 });
  await offline.setContent(html);
  const standalone = offline.getByRole('heading', { name: '主标题', exact: true });
  await expect
    .poll(() =>
      standalone.evaluate(
        (node) =>
          node.getBoundingClientRect().width /
          node.closest('.z-builder-flex')!.getBoundingClientRect().width
      )
    )
    .toBeCloseTo(0.5, 2);
  await offline.setViewportSize({ width: 390, height: 900 });
  await expect
    .poll(() =>
      standalone.evaluate(
        (node) =>
          node.getBoundingClientRect().width /
          node.closest('.z-builder-flex')!.getBoundingClientRect().width
      )
    )
    .toBeCloseTo(1, 2);
});

test('编辑器交互：页内锚点在画布和独立预览中滚动，保留当前文档', async ({ page }) => {
  await loadPage(page, [
    {
      type: 'Button',
      props: {
        id: 'jump-button',
        children: '跳到联系区',
        href: '#contact',
        action: 'button',
        variant: 'primary',
        size: 'md',
        disabled: false,
      },
    },
    ...Array.from({ length: 12 }, (_, index) => ({
      type: 'Spacer',
      props: { id: `gap-${index}`, height: 96 },
    })),
    {
      type: 'Section',
      props: {
        id: 'contact-section',
        title: '联系区',
        anchor: 'contact',
        tone: 'plain',
        padding: 24,
        content: [],
      },
    },
  ]);
  await page.getByRole('button', { name: '交互预览模式', exact: true }).click();
  const canvas = page.frameLocator('#builder-interactive-frame');
  const canvasDocument = await canvas.locator('body').evaluate((node) => node.ownerDocument.URL);
  await canvas.getByRole('link', { name: '跳到联系区', exact: true }).click();
  await expect(canvas.getByRole('heading', { name: '联系区', exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const target = await canvas.locator('#contact').boundingBox();
      const stage = await page.locator('.studio-canvas-scroll').boundingBox();
      return !!target && !!stage && target.y >= stage.y - 2 && target.y < stage.y + stage.height;
    })
    .toBe(true);
  await expect
    .poll(() => canvas.locator('body').evaluate((node) => node.ownerDocument.URL))
    .toBe(canvasDocument);
  await page.getByRole('button', { name: '预览页面', exact: true }).click();
  const preview = page.getByRole('dialog').frameLocator('iframe');
  await preview.getByRole('link', { name: '跳到联系区', exact: true }).click();
  await expect(preview.getByRole('heading', { name: '联系区', exact: true })).toBeVisible();
  await expect
    .poll(() =>
      preview.locator('#contact').evaluate((node) => {
        const view = node.ownerDocument.defaultView!;
        return view.scrollY > 0 && node.getBoundingClientRect().top < view.innerHeight;
      })
    )
    .toBe(true);
  await expect
    .poll(() => preview.locator('body').evaluate((node) => node.ownerDocument.URL))
    .toBe('about:srcdoc');
});

test('编辑器排版：分区、表单和分栏的栅格作用于内容，标题保持独立', async ({ page, context }) => {
  const types = ['Section', 'Form', 'Columns'];
  await loadPage(
    page,
    types.map((type) => ({
      type,
      props: {
        id: `grid-${type}`,
        ...(type === 'Columns' ? { columns: 2, gap: 24 } : { title: `${type} 标题` }),
        ...(type === 'Section' ? { anchor: '', tone: 'plain', padding: 24 } : {}),
        ...(type === 'Form' ? { successMessage: '已提交' } : {}),
        _design: {
          desktop: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24 },
          mobile: { gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', gap: 12 },
        },
        content: [1, 2].map((number) => ({
          type: 'Heading',
          props: {
            id: `${type}-${number}`,
            text: `${type} 第${number}列`,
            level: 'h3',
            align: 'left',
          },
        })),
      },
    }))
  );
  const canvas = page.frameLocator('#preview-frame');
  for (const type of types) {
    const first = canvas.getByRole('heading', { name: `${type} 第1列`, exact: true });
    const second = canvas.getByRole('heading', { name: `${type} 第2列`, exact: true });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expect
      .poll(() =>
        first.evaluate((node) => {
          const slot = node.closest('.z-builder-stack,.z-builder-columns')!;
          return Math.abs(
            node.getBoundingClientRect().width - (slot.getBoundingClientRect().width - 24) / 2
          );
        })
      )
      .toBeLessThan(1);
    await expect
      .poll(() =>
        first.evaluate((node) => {
          const peer = node
            .closest('.z-builder-stack,.z-builder-columns')!
            .querySelectorAll('h3')[1];
          return Math.abs(node.getBoundingClientRect().y - peer.getBoundingClientRect().y);
        })
      )
      .toBeLessThan(1);
    if (type !== 'Columns') {
      await expect
        .poll(() =>
          first.evaluate((node) => {
            const header = node
              .closest('.z-builder-section,.z-builder-form')
              ?.querySelector('.z-builder-section-title');
            return (
              !!header && header.getBoundingClientRect().bottom < node.getBoundingClientRect().top
            );
          })
        )
        .toBe(true);
    }
  }
  await page.getByRole('button', { name: '切换到手机画布', exact: true }).click();
  for (const type of types) {
    const first = canvas.getByRole('heading', { name: `${type} 第1列`, exact: true });
    await expect
      .poll(() =>
        first.evaluate(
          (node) =>
            node.getBoundingClientRect().width /
            node.closest('.z-builder-stack,.z-builder-columns')!.getBoundingClientRect().width
        )
      )
      .toBeCloseTo(1, 2);
  }
  const offline = await context.newPage();
  await offline.setViewportSize({ width: 1280, height: 900 });
  await offline.setContent(await exportedHtml(page));
  for (const type of types) {
    const first = offline.getByRole('heading', { name: `${type} 第1列`, exact: true });
    await expect
      .poll(() =>
        first.evaluate((node) => {
          const slot = node.closest('.z-builder-stack,.z-builder-columns')!;
          return Math.abs(
            node.getBoundingClientRect().width - (slot.getBoundingClientRect().width - 24) / 2
          );
        })
      )
      .toBeLessThan(1);
  }
});

test('编辑器工作流：复制全设备样式、重置覆盖、撤销、自定义尺寸和专注模式', async ({ page }) => {
  await loadPage(page, [
    {
      type: 'Heading',
      props: {
        id: 'style-source',
        text: '样式来源',
        level: 'h2',
        align: 'left',
        _design: { desktop: { fontSize: 48 }, mobile: { fontSize: 24 } },
      },
    },
    {
      type: 'Heading',
      props: {
        id: 'style-target',
        text: '样式目标',
        level: 'h2',
        align: 'left',
        _design: { desktop: { fontSize: 14 } },
      },
    },
  ]);
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await page
    .locator('[data-builder-layer-id="style-source"] > .studio-layer-row .studio-layer-select')
    .click();
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByRole('button', { name: '复制样式', exact: true }).click();
  await page
    .locator('[data-builder-layer-id="style-target"] > .studio-layer-row .studio-layer-select')
    .click();
  await page.getByRole('button', { name: '粘贴样式', exact: true }).click();
  const title = page
    .frameLocator('#preview-frame')
    .getByRole('heading', { name: '样式目标', exact: true });
  await expect(title).toHaveCSS('font-size', '48px');
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.getByRole('button', { name: '切换到手机画布', exact: true }).click();
  await expect(title).toHaveCSS('font-size', '24px');
  await page.getByRole('button', { name: '重置手机', exact: true }).click();
  await expect(title).toHaveCSS('font-size', '48px');
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(title).toHaveCSS('font-size', '24px');
  await page.getByRole('spinbutton', { name: '画布宽度', exact: true }).fill('820');
  await expect(title).toHaveCSS('font-size', '48px');
  await expect
    .poll(() =>
      page
        .locator('#preview-frame')
        .evaluate((node) => (node as HTMLIFrameElement).contentWindow?.innerWidth)
    )
    .toBe(820);
  const before = (await page.locator('#preview-frame').boundingBox())!.width;
  await page.getByRole('button', { name: '专注模式', exact: true }).click();
  await expect(page.getByRole('complementary', { name: '属性面板', exact: true })).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: '图层结构', exact: true })).toHaveCount(0);
  await expect
    .poll(async () => (await page.locator('#preview-frame').boundingBox())!.width)
    .toBeGreaterThan(before);
  await page.getByRole('button', { name: '退出专注模式', exact: true }).click();
  await expect(page.getByRole('complementary', { name: '属性面板', exact: true })).toBeVisible();
  await expect
    .poll(async () => (await page.locator('#preview-frame').boundingBox())!.width)
    .toBeCloseTo(before, 0);
});
