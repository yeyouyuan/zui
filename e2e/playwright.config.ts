import { defineConfig, devices } from '@playwright/test';

/**
 * ZUI 文档站冒烟 E2E 配置。
 *
 * - config 放在 e2e/ 内，testDir 即当前目录；
 * - 默认端口 5174；可用 ZUI_E2E_PORT 指定独立端口，CI 不复用已有服务；
 * - hash 路由站点无需 history fallback，直接访问 http://localhost:5174/。
 */
const port = Number(process.env.ZUI_E2E_PORT ?? 5174);

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm --filter @zui/docs dev --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
