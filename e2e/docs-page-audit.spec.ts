import { expect, test } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const routes = Array.from(
  readFileSync(new URL('../docs/src/nav.ts', import.meta.url), 'utf8').matchAll(
    /\{ title: '([^']+)', path: '([^']+)', group: '[^']+' \}/g
  ),
  (match) => ({ title: match[1], path: match[2] })
);
const axeSource = readFileSync(
  new URL('../packages/ui/node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
);

for (const width of [1440, 320]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`逐页显示审计：${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      test.setTimeout(300_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      const issues: unknown[] = [];
      page.on('pageerror', (error) => issues.push({ path: page.url(), error: error.message }));
      const records: unknown[] = [];
      const directory = process.env.ZUI_AUDIT_DIR
        ? path.join(process.env.ZUI_AUDIT_DIR, `${width}-${colorScheme}`)
        : undefined;
      if (directory) mkdirSync(directory, { recursive: true });
      await page.goto('/');
      await expect(page.locator('.doc-page h1').first()).toBeVisible();
      await page.addScriptTag({ content: axeSource });
      for (const [index, route] of routes.entries()) {
        await page.evaluate((next) => {
          window.location.hash = next;
        }, route.path);
        await expect(page.locator('.doc-main')).toHaveAttribute('data-route', route.path);
        await expect(page.locator('.doc-page h1').first()).toBeVisible();
        await expect(page.getByLabel('正在加载文档')).toHaveCount(0);
        await expect(page.locator('.doc-page > .doc-h1, .doc-page > .doc-hero > h1')).toHaveCount(
          1
        );
        await expect(page.getByText('页面出错了', { exact: true })).toHaveCount(0);
        await expect
          .poll(() =>
            page
              .locator('.doc-demo img')
              .evaluateAll((images) =>
                images.every((image) => (image as HTMLImageElement).complete)
              )
          )
          .toBe(true);
        const layout = await page.locator('.doc-main').evaluate((main) => {
          const problems: string[] = [];
          if (main.scrollWidth > main.clientWidth + 1)
            problems.push(`正文溢出 ${main.scrollWidth}/${main.clientWidth}`);
          if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('页面横向溢出');
          for (const image of main.querySelectorAll<HTMLImageElement>('.doc-demo img')) {
            if (image.naturalWidth === 0) problems.push(`图片未成功加载：${image.alt}`);
          }
          for (const track of main.querySelectorAll<HTMLElement>('.z-slider-track')) {
            if (track.getBoundingClientRect().width < 24) problems.push('Slider 轨道宽度不足');
          }
          for (const stage of main.querySelectorAll<HTMLElement>('.doc-demo-stage')) {
            const rect = stage.getBoundingClientRect();
            for (const child of stage.children) {
              const box = child.getBoundingClientRect();
              if (
                box.width > 1 &&
                box.height > 1 &&
                (box.right > rect.right + 1 || box.left < rect.left - 1)
              ) {
                problems.push(
                  `${stage.closest('section')?.querySelector('h3')?.textContent}: ${child.tagName}.${child.className} 被演示容器裁切`
                );
              }
            }
          }
          return problems;
        });
        type Axe = {
          run(
            root: Element,
            options: object
          ): Promise<{
            violations: Array<{
              id: string;
              nodes: Array<{ target: string[]; failureSummary: string }>;
            }>;
          }>;
        };
        const contrast = await page.locator('.doc-main').evaluate(async (main) => {
          const { violations } = await (window as unknown as { axe: Axe }).axe.run(main, {
            runOnly: { type: 'rule', values: ['color-contrast'] },
            resultTypes: ['violations'],
          });
          return violations.flatMap((rule) =>
            rule.nodes.map((node) => ({
              rule: rule.id,
              target: node.target,
              detail: node.failureSummary,
            }))
          );
        });
        records.push({ ...route, layout, contrast });
        if (layout.length || contrast.length) issues.push({ ...route, layout, contrast });
        if (directory) {
          await page.locator('.doc-main').evaluate((main) => {
            main.scrollTop = 0;
          });
          await page.screenshot({
            path: path.join(directory, `${String(index).padStart(2, '0')}.png`),
          });
        }
      }
      const report = JSON.stringify(
        { width, colorScheme, pages: routes.length, records, issues },
        null,
        2
      );
      if (directory) writeFileSync(path.join(directory, 'report.json'), report);
      await testInfo.attach('逐页检查结果', { body: report, contentType: 'application/json' });
      expect(issues).toEqual([]);
    });
  }
}
