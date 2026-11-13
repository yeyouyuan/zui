import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ExcelJS from '../docs/node_modules/exceljs/excel.js';
import JSZip from '../docs/node_modules/jszip/lib/index.js';
import { PDFDocument } from '../docs/node_modules/pdf-lib/cjs/index.js';

// These are host integration tests. The controlled DocsAPI below creates an
// iframe and emits the documented host events; it does not implement or inspect
// ONLYOFFICE's native document canvas, toolbar, text editing or calculations.
const editorOrigin = 'https://office-host-integration.test';
const editorApiSource = String.raw`
(() => {
  const state = window.__officeHostMock = { mounts: [], destroyedKeys: [], active: {} };
  window.DocsAPI = {
    DocEditor: function (id, config) {
      const host = document.getElementById(id);
      if (!host) throw new Error('The host editor mount was not found.');
      const key = config.document.key;
      const frame = document.createElement('iframe');
      frame.title = '受控 DocsAPI 宿主集成占位';
      frame.dataset.officeHostMock = 'true';
      frame.dataset.documentKey = key;
      frame.dataset.mockInstance = String(state.mounts.length + 1);
      frame.style.cssText = 'width:100%;height:100%;border:0';
      frame.srcdoc = '<!doctype html><html lang="zh-CN"><body><p>受控文档引擎占位，仅测试宿主接入。</p></body></html>';
      state.mounts.push({
        id, key, documentType: config.documentType, type: config.type,
        document: JSON.parse(JSON.stringify(config.document)),
        editorConfig: JSON.parse(JSON.stringify(config.editorConfig))
      });
      let destroyed = false;
      const control = {
        change(value) {
          if (!destroyed) config.events.onDocumentStateChange?.({ data: value });
        }
      };
      state.active[key] = control;
      frame.addEventListener('load', () => {
        if (!destroyed) config.events.onDocumentReady?.({ data: undefined });
      });
      host.append(frame);
      this.destroyEditor = () => {
        if (destroyed) return;
        destroyed = true;
        state.destroyedKeys.push(key);
        if (state.active[key] === control) delete state.active[key];
        frame.remove();
      };
    }
  };
})();
`;

type OfficeKind = 'Word' | 'Excel' | 'PDF';
type OfficeMode = 'edit' | 'view';
const formats = {
  Word: {
    extension: 'docx',
    documentType: 'word',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  Excel: {
    extension: 'xlsx',
    documentType: 'cell',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  PDF: { extension: 'pdf', documentType: 'pdf', mime: 'application/pdf' },
} as const;

const dataKinds = { Word: 'word', Excel: 'excel', PDF: 'pdf' } as const;

interface EditorConfiguration {
  documentType: 'word' | 'cell' | 'pdf';
  type: 'desktop';
  document: {
    key: string;
    title: string;
    fileType: string;
    url: string;
    isForm?: boolean;
    permissions: { edit: boolean; download: boolean; print: boolean };
  };
  editorConfig: {
    mode: OfficeMode;
    lang: string;
    callbackUrl: string;
    customization: { autosave: boolean; forcesave: boolean };
  };
  token: string;
}
interface EditorMount extends Omit<EditorConfiguration, 'token'> {
  id: string;
  key: string;
}
interface HostMockState {
  mounts: EditorMount[];
  destroyedKeys: string[];
  active: Record<string, { change(value: boolean): void }>;
}
interface GeneratedResult {
  sequence: number;
  hash: string;
  size: number;
  requestId: string;
  bytes: Buffer;
}
interface MockSession {
  id: string;
  fileId: string;
  name: string;
  kind: OfficeKind;
  mode: OfficeMode;
  accessToken: string;
  source: Buffer;
  uploadType: string;
  baseRevision: number;
  ackRevision: number;
  ackSequence: number;
  config: EditorConfiguration;
  result?: GeneratedResult;
  staged?: Buffer;
}
interface SaveAck {
  sessionId: string;
  sequence: number;
  revision: number;
  hash: string;
}
interface WorkspaceBackup {
  format: string;
  data: {
    files: { id: string; name: string; revision: number; assetKey: string | null }[];
    officeDrafts?: Record<string, unknown>;
  };
  assets: Record<string, string>;
}

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function sessionState(session: MockSession) {
  const result = session.result;
  return {
    id: session.id,
    key: session.config.document.key,
    fileId: session.fileId,
    mode: session.mode,
    baseRevision: session.baseRevision,
    ackRevision: session.ackRevision,
    sequence: result?.sequence ?? 0,
    ackSequence: session.ackSequence,
    state: result ? 'saved' : 'editing',
    error: '',
    config: session.config,
    ...(result
      ? {
          result: {
            sequence: result.sequence,
            hash: result.hash,
            size: result.size,
            requestId: result.requestId,
          },
        }
      : {}),
  };
}
async function json(route: Route, value: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
}

async function installHostIntegrationMock(page: Page, available = true) {
  const sessions = new Map<string, MockSession>();
  const acks: SaveAck[] = [];
  const forceRequests: { sessionId: string; requestId: string }[] = [];
  const unexpected: string[] = [];
  const ackGates: Promise<void>[] = [];
  let scriptRequests = 0;
  await page.route('**/web-apps/apps/api/documents/api.js', async (route) => {
    scriptRequests++;
    await route.fulfill({ contentType: 'application/javascript', body: editorApiSource });
  });
  await page.route('**/api/office/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/office/health') {
      await json(route, {
        available,
        version: 'host-integration-mock',
        documentServerUrl: editorOrigin,
        error: available ? '' : '受控文档服务暂不可用。',
      });
      return;
    }
    if (url.pathname === '/api/office/sessions' && request.method() === 'POST') {
      const name = url.searchParams.get('name') ?? '';
      const kind = (Object.keys(formats) as OfficeKind[]).find((candidate) =>
        name.toLowerCase().endsWith(`.${formats[candidate].extension}`)
      );
      const source = request.postDataBuffer();
      const mode = url.searchParams.get('mode');
      const revision = Number(url.searchParams.get('revision'));
      if (
        !available ||
        !kind ||
        !source ||
        !['edit', 'view'].includes(mode ?? '') ||
        revision < 1
      ) {
        await json(route, { error: '受控会话请求无效。' }, 400);
        return;
      }
      const id = randomUUID();
      const key = sha256(Buffer.from(id));
      const config: EditorConfiguration = {
        documentType: formats[kind].documentType,
        type: 'desktop',
        document: {
          key,
          title: name,
          fileType: formats[kind].extension,
          url: `${editorOrigin}/controlled-source/${id}`,
          ...(kind === 'PDF' ? { isForm: false } : {}),
          permissions: { edit: mode === 'edit', download: true, print: true },
        },
        editorConfig: {
          mode: mode as OfficeMode,
          lang: 'zh-CN',
          callbackUrl: `${editorOrigin}/controlled-callback/${id}`,
          customization: { autosave: true, forcesave: true },
        },
        token: 'controlled-host-config-token',
      };
      const session: MockSession = {
        id,
        fileId: url.searchParams.get('fileId') ?? '',
        name,
        kind,
        mode: mode as OfficeMode,
        accessToken: randomUUID(),
        source,
        uploadType: request.headers()['content-type'] ?? '',
        baseRevision: revision,
        ackRevision: revision,
        ackSequence: 0,
        config,
      };
      sessions.set(id, session);
      await json(route, { id, key, accessToken: session.accessToken, config, sequence: 0 }, 201);
      return;
    }
    const path =
      /^\/api\/office\/sessions\/([^/]+)(?:\/(force-save|ack|results\/([1-9]\d*)))?$/.exec(
        url.pathname
      );
    const session = path ? sessions.get(path[1]) : undefined;
    if (!path || !session) {
      unexpected.push(`${request.method()} ${url.pathname}`);
      await json(route, { error: '受控会话不存在。' }, 404);
      return;
    }
    if (request.headers()['x-office-session-token'] !== session.accessToken) {
      unexpected.push(`missing session token: ${url.pathname}`);
      await json(route, { error: '受控会话凭据无效。' }, 401);
      return;
    }
    if (!path[2] && request.method() === 'GET') {
      await json(route, sessionState(session));
      return;
    }
    if (path[2] === 'force-save' && request.method() === 'POST') {
      const body = request.postDataJSON() as { requestId?: string };
      if (session.mode !== 'edit' || !body.requestId || !/^[a-f0-9-]{36}$/.test(body.requestId)) {
        await json(route, { error: '受控保存请求无效。' }, 403);
        return;
      }
      forceRequests.push({ sessionId: session.id, requestId: body.requestId });
      if (!session.staged) {
        await json(route, { noChanges: true, requestId: body.requestId });
        return;
      }
      const bytes = session.staged;
      const digest = sha256(bytes);
      const sequence =
        session.result?.hash === digest
          ? session.result.sequence
          : (session.result?.sequence ?? 0) + 1;
      session.result = {
        bytes,
        hash: digest,
        size: bytes.length,
        sequence,
        requestId: body.requestId,
      };
      session.staged = undefined;
      await json(route, { accepted: true, noChanges: false, sequence, requestId: body.requestId });
      return;
    }
    if (path[2] === 'ack' && request.method() === 'POST') {
      const body = request.postDataJSON() as Omit<SaveAck, 'sessionId'>;
      const result = session.result;
      if (
        !result ||
        body.sequence !== result.sequence ||
        body.hash !== result.hash ||
        body.revision <= session.baseRevision ||
        body.revision < session.ackRevision ||
        (body.sequence === session.ackSequence && body.revision !== session.ackRevision)
      ) {
        await json(route, { error: '受控保存确认与文件不一致。' }, 409);
        return;
      }
      session.ackSequence = body.sequence;
      session.ackRevision = body.revision;
      acks.push({ sessionId: session.id, ...body });
      const gate = ackGates.shift();
      if (gate) await gate;
      await json(route, sessionState(session));
      return;
    }
    if (path[3] && request.method() === 'GET' && Number(path[3]) === session.result?.sequence) {
      await route.fulfill({ contentType: formats[session.kind].mime, body: session.result.bytes });
      return;
    }
    unexpected.push(`${request.method()} ${url.pathname}`);
    await json(route, { error: '受控宿主接口不支持此请求。' }, 404);
  });
  return {
    sessions,
    acks,
    forceRequests,
    unexpected,
    scriptRequests: () => scriptRequests,
    holdNextAck() {
      let release!: () => void;
      ackGates.push(
        new Promise<void>((resolve) => {
          release = resolve;
        })
      );
      return { release };
    },
  };
}
type HostIntegrationMock = Awaited<ReturnType<typeof installHostIntegrationMock>>;

async function openWorkspace(page: Page) {
  await page.goto('/#/collaboration');
  await expect(page.getByRole('status', { name: '工作区保存状态', exact: true })).toHaveText(
    '已保存到本机'
  );
}
function editorRegion(page: Page) {
  return page.getByRole('region', { name: / 在线编辑器$/ });
}
async function editorReady(page: Page) {
  const region = editorRegion(page);
  await expect(region).toBeVisible();
  await expect(region.locator('iframe[data-office-host-mock="true"]')).toHaveCount(1);
  await expect(
    region.getByRole('status', { name: '文档编辑保存状态', exact: true })
  ).not.toHaveText(/正在连接|正在打开/);
  return region;
}
async function openSample(page: Page, kind: OfficeKind) {
  await page.getByRole('button', { name: `${kind} 示例`, exact: true }).click();
  return editorReady(page);
}
async function mountedSession(page: Page, fixture: HostIntegrationMock) {
  const key = await editorRegion(page)
    .locator('iframe[data-office-host-mock="true"]')
    .getAttribute('data-document-key');
  const session = [...fixture.sessions.values()].find((entry) => entry.config.document.key === key);
  if (!session) throw new Error('The mounted controlled editor has no matching bridge session.');
  return session;
}
async function hostSnapshot(page: Page) {
  return page.evaluate(() => {
    const state = (window as unknown as { __officeHostMock: HostMockState }).__officeHostMock;
    return { mounts: state.mounts, destroyedKeys: state.destroyedKeys };
  });
}
async function emitControlledState(page: Page, key: string, changed: boolean) {
  await page.evaluate(
    ({ key, changed }) => {
      const control = (window as unknown as { __officeHostMock: HostMockState }).__officeHostMock
        .active[key];
      if (!control) throw new Error('The controlled editor was already destroyed.');
      control.change(changed);
    },
    { key, changed }
  );
}
async function downloadBytes(page: Page, button: Locator) {
  const pending = page.waitForEvent('download');
  await button.click();
  const download = await pending;
  const filename = await download.path();
  expect(filename).not.toBeNull();
  return readFileSync(filename!);
}

/** 下载文件入口在「文件」菜单内，菜单内容通过 Portal 渲染在 body 上。 */
async function downloadViaFileMenu(page: Page) {
  const pending = page.waitForEvent('download');
  await editorRegion(page).getByRole('button', { name: '文件', exact: true }).click();
  await page.getByRole('menuitem', { name: '下载文件', exact: true }).click();
  const download = await pending;
  const filename = await download.path();
  expect(filename).not.toBeNull();
  return readFileSync(filename!);
}
async function savedToWorkspace(page: Page) {
  await expect(
    editorRegion(page).getByRole('status', { name: '文档编辑保存状态', exact: true })
  ).toHaveText('已保存到工作台');
  await expect(page.getByRole('status', { name: '工作区保存状态', exact: true })).toHaveText(
    '已保存到本机'
  );
}

async function validateUploadedSample(session: MockSession) {
  expect(session.uploadType).toBe(formats[session.kind].mime);
  expect(session.source.length).toBeGreaterThan(0);
  if (session.kind === 'Word') {
    const zip = await JSZip.loadAsync(session.source);
    expect(await zip.file('word/document.xml')!.async('string')).toContain('项目评审方案');
  } else if (session.kind === 'Excel') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(session.source);
    expect(workbook.getWorksheet('预算')!.getCell('A2').value).toBe(100);
    expect(workbook.getWorksheet('汇总')!.getCell('B1').value).toEqual({
      formula: "'预算'!C4",
      result: 440,
    });
  } else {
    const pdf = await PDFDocument.load(session.source);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getForm().getFields()).toHaveLength(3);
  }
}

// Generate valid controlled result files, independent of any native editor UI.
// Comparing their bytes after download checks the host's save/writeback path.
async function controlledResult(session: MockSession): Promise<Buffer> {
  if (session.kind === 'Word') {
    const zip = await JSZip.loadAsync(session.source);
    const xml = await zip.file('word/document.xml')!.async('string');
    zip.file('word/document.xml', xml.replace('待复核', 'HOST_SAVE_DOCX'));
    return zip.generateAsync({ type: 'nodebuffer' });
  }
  if (session.kind === 'Excel') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(session.source);
    workbook.getWorksheet('预算')!.getCell('A2').value = 150;
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
  const pdf = await PDFDocument.load(session.source);
  pdf.setTitle('HOST_SAVE_PDF');
  return Buffer.from(await pdf.save());
}

test.describe('Office 宿主集成（受控 DocsAPI 与桥接服务）', () => {
  for (const kind of ['Word', 'Excel', 'PDF'] as const) {
    test(`${kind} 示例生成真实文件，宿主启动 iframe 并回写受控结果`, async ({ page }) => {
      test.setTimeout(60000);
      const fixture = await installHostIntegrationMock(page);
      await openWorkspace(page);
      const editor = await openSample(page, kind);
      const session = await mountedSession(page, fixture);
      await validateUploadedSample(session);
      const { mounts } = await hostSnapshot(page);
      const mount = mounts.find((entry) => entry.key === session.config.document.key)!;
      expect(mount.documentType).toBe(formats[kind].documentType);
      expect(mount.type).toBe('desktop');
      expect(mount.document.fileType).toBe(formats[kind].extension);
      expect(mount.editorConfig.mode).toBe('edit');
      expect(mount.document.permissions.edit).toBe(true);
      if (kind === 'PDF') expect(mount.document.isForm).toBe(false);
      await expect(editor).toHaveAttribute('data-kind', dataKinds[kind]);
      const output = await controlledResult(session);
      expect(output).not.toEqual(session.source);
      session.staged = output;
      await emitControlledState(page, session.config.document.key, true);
      await editor.getByRole('button', { name: '保存到工作台', exact: true }).click();
      await emitControlledState(page, session.config.document.key, false);
      await savedToWorkspace(page);
      expect(await downloadViaFileMenu(page)).toEqual(output);
      expect(session.ackRevision).toBe(session.baseRevision + 1);
      expect(session.ackSequence).toBe(1);
      expect(
        fixture.forceRequests.some((request) => request.requestId === session.result?.requestId)
      ).toBe(true);
      expect(fixture.unexpected).toEqual([]);
      expect(fixture.scriptRequests()).toBeGreaterThan(0);
    });
  }

  test('外层 Ctrl/Cmd+S 保存到工作台，文件菜单可下载最新结果', async ({ page }) => {
    test.setTimeout(60000);
    const fixture = await installHostIntegrationMock(page);
    await openWorkspace(page);
    const editor = await openSample(page, 'Word');
    await expect(editor).toHaveAttribute('data-kind', 'word');
    const session = await mountedSession(page, fixture);
    const output = await controlledResult(session);
    session.staged = output;
    await emitControlledState(page, session.config.document.key, true);
    // Ctrl/Cmd+S 只在外层 chrome 聚焦时由工作台接管；iframe 内的同名快捷键
    // 由原生引擎走保存回调，两条路径最终都汇入同一 force-save。
    await page.keyboard.press('ControlOrMeta+s');
    await emitControlledState(page, session.config.document.key, false);
    await savedToWorkspace(page);
    expect(session.ackRevision).toBe(session.baseRevision + 1);
    expect(
      fixture.forceRequests.some((request) => request.requestId === session.result?.requestId)
    ).toBe(true);
    expect(await downloadViaFileMenu(page)).toEqual(output);
    expect(fixture.unexpected).toEqual([]);
  });

  test('自动保存开关：关闭后空闲不回写，重新打开后由轮询完成回写', async ({ page }) => {
    test.setTimeout(60000);
    const fixture = await installHostIntegrationMock(page);
    await openWorkspace(page);
    const editor = await openSample(page, 'Word');
    const session = await mountedSession(page, fixture);
    const output = await controlledResult(session);
    session.staged = output;
    const toggle = editor.getByRole('switch', { name: '自动保存' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await emitControlledState(page, session.config.document.key, true);
    // 空闲窗口（5s）加轮询周期（2.5s）后仍未回写，状态如实反映未保存修改。
    await page.waitForTimeout(8500);
    expect(session.ackRevision).toBe(session.baseRevision);
    await expect(editor.getByRole('status', { name: '文档编辑保存状态', exact: true })).toHaveText(
      '编辑中 · 有未保存修改'
    );
    // 引擎静默后重新打开开关，下一轮轮询应完成回写。
    await emitControlledState(page, session.config.document.key, false);
    await toggle.click();
    await savedToWorkspace(page);
    expect(session.ackRevision).toBe(session.baseRevision + 1);
    expect(await downloadViaFileMenu(page)).toEqual(output);
    expect(fixture.unexpected).toEqual([]);
  });

  test('保存确认等待期间原文件版本更新，宿主保持同一个 iframe 与 document key', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const fixture = await installHostIntegrationMock(page);
    await openWorkspace(page);
    const editor = await openSample(page, 'Word');
    const session = await mountedSession(page, fixture);
    const frame = editor.locator('iframe[data-office-host-mock="true"]');
    const instance = await frame.getAttribute('data-mock-instance');
    const before = await hostSnapshot(page);
    const output = await controlledResult(session);
    expect(output).not.toEqual(session.source);
    session.staged = output;
    const gate = fixture.holdNextAck();
    try {
      await emitControlledState(page, session.config.document.key, true);
      await editor.getByRole('button', { name: '保存到工作台', exact: true }).click();
      await emitControlledState(page, session.config.document.key, false);
      await expect.poll(() => fixture.acks.length).toBe(1);
      await expect(
        editor.getByRole('status', { name: '文档编辑保存状态', exact: true })
      ).toHaveText('正在保存到工作台…');
      await expect(frame).toHaveAttribute('data-document-key', session.config.document.key);
      await expect(frame).toHaveAttribute('data-mock-instance', instance!);
      expect(await hostSnapshot(page)).toEqual(before);
    } finally {
      gate.release();
    }
    await savedToWorkspace(page);
    await expect(frame).toHaveAttribute('data-mock-instance', instance!);
    expect(await hostSnapshot(page)).toEqual(before);
    expect(await downloadViaFileMenu(page)).toEqual(output);
    await editor.getByRole('button', { name: '返回工作台', exact: true }).click();
    await editor.getByRole('button', { name: '展开编辑器', exact: true }).click();
    await expect(frame).toHaveAttribute('data-mock-instance', instance!);
    expect(await hostSnapshot(page)).toEqual(before);
    expect(fixture.unexpected).toEqual([]);
  });

  test('切换只读透传 view 配置，宿主不提交编辑事件并保留原文件下载', async ({ page }) => {
    test.setTimeout(60000);
    const fixture = await installHostIntegrationMock(page);
    await openWorkspace(page);
    const editor = await openSample(page, 'Word');
    const editable = await mountedSession(page, fixture);
    await editor.getByRole('button', { name: '返回工作台', exact: true }).click();
    await page.getByText('工作区设置', { exact: true }).click();
    await page.getByRole('combobox', { name: '访问权限', exact: true }).selectOption('read');
    await editorReady(page);
    await expect(editor.getByRole('status', { name: '文档编辑保存状态', exact: true })).toHaveText(
      '只读预览'
    );
    const viewing = await mountedSession(page, fixture);
    expect(viewing.mode).toBe('view');
    expect(viewing.config.document.permissions.edit).toBe(false);
    const viewingMount = (await hostSnapshot(page)).mounts.find(
      (entry) => entry.key === viewing.config.document.key
    )!;
    expect(viewingMount.editorConfig.mode).toBe('view');
    expect(viewingMount.document.permissions.edit).toBe(false);
    const before = { acks: fixture.acks.length, forces: fixture.forceRequests.length };
    await emitControlledState(page, viewing.config.document.key, true);
    await emitControlledState(page, viewing.config.document.key, false);
    await expect(editor.getByRole('button', { name: '保存到工作台', exact: true })).toBeDisabled();
    await expect(editor.getByRole('status', { name: '文档编辑保存状态', exact: true })).toHaveText(
      '只读预览'
    );
    expect(await downloadViaFileMenu(page)).toEqual(editable.source);
    expect({ acks: fixture.acks.length, forces: fixture.forceRequests.length }).toEqual(before);
    expect(fixture.unexpected).toEqual([]);
  });

  test('服务不可用时宿主保存禁用，Word 原件仍可下载且刷新后不变', async ({ page }) => {
    const fixture = await installHostIntegrationMock(page, false);
    await openWorkspace(page);
    const original = Buffer.from('retained-local-docx-bytes');
    await page.getByLabel('导入本地文件', { exact: true }).setInputFiles({
      name: '保留原件.docx',
      mimeType: formats.Word.mime,
      buffer: original,
    });
    const editor = editorRegion(page);
    await expect(
      editor.getByRole('heading', { name: '完整文档编辑器尚未连接', exact: true })
    ).toBeVisible();
    await expect(editor.getByRole('alert')).toContainText('受控文档服务暂不可用。');
    await expect(editor.getByRole('button', { name: '保存到工作台', exact: true })).toBeDisabled();
    expect(await downloadViaFileMenu(page)).toEqual(original);
    await expect(page.getByRole('status', { name: '工作区保存状态', exact: true })).toHaveText(
      '已保存到本机'
    );
    await page.reload();
    await expect(
      editor.getByRole('heading', { name: '完整文档编辑器尚未连接', exact: true })
    ).toBeVisible();
    expect(await downloadViaFileMenu(page)).toEqual(original);
    expect(fixture.sessions.size).toBe(0);
    expect(fixture.scriptRequests()).toBe(0);
    expect(fixture.unexpected).toEqual([]);
  });

  test('宿主备份包含已回写的 Word 文件，独立浏览器工作区恢复相同字节', async ({
    page,
    browser,
  }) => {
    test.setTimeout(60000);
    const fixture = await installHostIntegrationMock(page);
    await openWorkspace(page);
    const editor = await openSample(page, 'Word');
    const session = await mountedSession(page, fixture);
    const output = await controlledResult(session);
    expect(output).not.toEqual(session.source);
    session.staged = output;
    await emitControlledState(page, session.config.document.key, true);
    await editor.getByRole('button', { name: '保存到工作台', exact: true }).click();
    await emitControlledState(page, session.config.document.key, false);
    await savedToWorkspace(page);
    await editor.getByRole('button', { name: '返回工作台', exact: true }).click();
    await page.getByText('工作区设置', { exact: true }).click();
    const backupBytes = await downloadBytes(
      page,
      page.getByRole('button', { name: '导出工作区备份', exact: true })
    );
    const backup = JSON.parse(backupBytes.toString('utf8')) as WorkspaceBackup;
    expect(backup.format).toBe('zui-content-workspace');
    const stored = backup.data.files.find((file) => file.id === session.fileId)!;
    expect(stored.revision).toBe(session.ackRevision);
    expect(backup.data.officeDrafts?.[stored.id]).toBeUndefined();
    expect(Buffer.from(backup.assets[stored.assetKey!].split(',')[1], 'base64')).toEqual(output);
    const restoredContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const restored = await restoredContext.newPage();
      const recoveredFixture = await installHostIntegrationMock(restored);
      await openWorkspace(restored);
      await restored.getByLabel('导入工作区备份文件', { exact: true }).setInputFiles({
        name: 'office-host-backup.json',
        mimeType: 'application/json',
        buffer: backupBytes,
      });
      await restored
        .getByRole('navigation', { name: '协作文件', exact: true })
        .getByRole('button', { name: /^项目评审示例\.docx/ })
        .click();
      const recoveredEditor = await editorReady(restored);
      await expect(recoveredEditor).toHaveAttribute('data-kind', 'word');
      const recovered = await mountedSession(restored, recoveredFixture);
      expect(recovered.fileId).not.toBe(session.fileId);
      expect(recovered.baseRevision).toBe(session.ackRevision);
      expect(recovered.source).toEqual(output);
      expect(await downloadViaFileMenu(restored)).toEqual(output);
      expect(recoveredFixture.unexpected).toEqual([]);
    } finally {
      await restoredContext.close();
    }
  });
});
