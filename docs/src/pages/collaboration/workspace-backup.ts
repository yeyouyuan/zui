import {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TEXT_BYTES,
  MAX_WORKSPACE_BYTES,
  textBlob,
  validName,
  type Workspace,
  type WorkspaceFile,
  type Discussion,
} from './workspace-model';
import { validateOfficeDraft, type OfficeDraft } from './office/office-model';

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('无法读取附件，备份未完成。'));
    reader.readAsDataURL(blob);
  });
}
export async function exportBackup(
  data: Workspace,
  asset: (key: string) => Promise<Blob>
): Promise<Blob> {
  const assets: Record<string, string> = {};
  for (const file of data.files)
    if (file.assetKey) assets[file.assetKey] = await dataUrl(await asset(file.assetKey));
  return new Blob([JSON.stringify({ format: 'zui-content-workspace', version: 1, data, assets })], {
    type: 'application/json',
  });
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('备份结构无效。');
  return value as Record<string, unknown>;
}
function list(value: unknown, max = 10000): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('备份列表无效或超出上限。');
  return value;
}
function text(value: unknown, max = 1024 * 1024): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('备份字段无效或超出上限。');
  return value;
}
function date(value: unknown): string {
  const result = text(value, 60);
  if (!Number.isFinite(Date.parse(result))) throw new Error('备份日期无效。');
  return result;
}
function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new Error('备份版本无效。');
  return value;
}
/** Restore as independent copies; existing files and discussions are never overwritten. */
export async function importBackup(
  source: File
): Promise<{ data: Workspace; assets: Map<string, Blob> }> {
  if (source.size > MAX_WORKSPACE_BYTES * 1.5) throw new Error('备份超过 150 MB 上限。');
  let raw: Record<string, unknown>;
  try {
    raw = record(JSON.parse(await source.text()));
  } catch {
    throw new Error('无法读取备份，请选择本工作台导出的 JSON 文件。');
  }
  if (raw.format !== 'zui-content-workspace' || raw.version !== 1)
    throw new Error('这不是受支持的工作台备份。');
  const original = record(raw.data);
  const sourceAssets = record(raw.assets);
  const ids = new Map<string, string>();
  const blockIds = new Map<string, string>();
  const assets = new Map<string, Blob>();
  let total = 0;
  const files = list(original.files, MAX_FILES).map((entry): WorkspaceFile => {
    const item = record(entry);
    const oldId = text(item.id, 200);
    if (ids.has(oldId)) throw new Error('备份含有重复文件标识。');
    const id = crypto.randomUUID();
    ids.set(oldId, id);
    const kind = item.kind;
    if (
      kind !== 'text' &&
      kind !== 'image' &&
      kind !== 'pdf' &&
      kind !== 'word' &&
      kind !== 'excel' &&
      kind !== 'binary'
    )
      throw new Error('备份文件类型无效。');
    const blocks = list(item.blocks, 1000).map((entry) => {
      const block = record(entry);
      const oldBlockId = text(block.id, 200);
      const key = `${oldId}:${oldBlockId}`;
      if (blockIds.has(key)) throw new Error('备份含有重复段落标识。');
      const blockId = crypto.randomUUID();
      blockIds.set(key, blockId);
      return { id: blockId, title: text(block.title, 180), body: text(block.body) };
    });
    if (kind === 'text' && !blocks.length) throw new Error('文本备份缺少正文。');
    const file: WorkspaceFile = {
      id,
      name: validName(text(item.name, 180)),
      kind,
      blocks,
      mime: text(item.mime, 200),
      size: 0,
      revision: revision(item.revision),
      assetKey: kind === 'text' ? null : id,
      updatedAt: date(item.updatedAt),
      bom: item.bom === true,
    };
    if (kind === 'text') {
      file.size = textBlob(file).size;
      if (file.size > MAX_TEXT_BYTES) throw new Error(`${file.name} 的正文超过 1 MB。`);
    } else {
      const encoded = text(sourceAssets[text(item.assetKey, 200)], MAX_FILE_BYTES * 1.4);
      const match = /^data:[^,]*;base64,([A-Za-z0-9+/=]*)$/.exec(encoded);
      if (!match) throw new Error(`${file.name} 的附件编码无效。`);
      const binary = atob(match[1]);
      if (binary.length > MAX_FILE_BYTES) throw new Error(`${file.name} 超过 20 MB。`);
      const blob = new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], {
        type: file.mime,
      });
      file.size = blob.size;
      assets.set(id, blob);
    }
    total += file.size;
    if (total > MAX_WORKSPACE_BYTES) throw new Error('备份文件总量超过 100 MB。');
    return file;
  });
  const threadIds = new Map<string, string>();
  const threads = list(original.threads).map((entry): Discussion => {
    const thread = record(entry);
    const oldId = text(thread.id, 200);
    const oldFile = text(thread.file, 200);
    const file = ids.get(oldFile);
    if (!file || threadIds.has(oldId)) throw new Error('备份讨论的文件或标识无效。');
    const id = crypto.randomUUID();
    threadIds.set(oldId, id);
    const anchor =
      thread.anchor === null ? null : blockIds.get(`${oldFile}:${text(thread.anchor, 200)}`);
    if (anchor === undefined) throw new Error('备份讨论指向了不存在的段落。');
    return {
      id,
      file,
      anchor,
      quote: text(thread.quote),
      quoteRevision: thread.quoteRevision === null ? null : revision(thread.quoteRevision),
      author: text(thread.author, 40),
      body: text(thread.body, 2000),
      createdAt: date(thread.createdAt),
      resolved: thread.resolved === true,
      replies: list(thread.replies).map((entry) => {
        const reply = record(entry);
        return {
          id: crypto.randomUUID(),
          author: text(reply.author, 40),
          body: text(reply.body, 2000),
          createdAt: date(reply.createdAt),
        };
      }),
    };
  });
  const editorDrafts: Workspace['editorDrafts'] = {};
  for (const [oldFile, entry] of Object.entries(record(original.editorDrafts))) {
    const draft = record(entry);
    const file = ids.get(oldFile);
    const blockId = blockIds.get(`${oldFile}:${text(draft.blockId, 200)}`);
    if (!file || !blockId) throw new Error('备份编辑草稿的关联无效。');
    editorDrafts[file] = {
      blockId,
      body: text(draft.body),
      baseRevision: revision(draft.baseRevision),
    };
  }
  const commentDrafts: Workspace['commentDrafts'] = {};
  for (const [oldFile, newFile] of ids) {
    for (const [key, value] of Object.entries(record(original.commentDrafts))) {
      if (!key.startsWith(`${oldFile}:`)) continue;
      const target = key.slice(oldFile.length + 1);
      const suffix =
        target === 'file'
          ? 'file'
          : target.startsWith('reply:')
            ? `reply:${threadIds.get(target.slice(6)) ?? ''}`
            : blockIds.get(`${oldFile}:${target}`);
      if (!suffix || suffix === 'reply:') throw new Error('备份评论草稿的关联无效。');
      commentDrafts[`${newFile}:${suffix}`] = text(value, 2000);
    }
  }
  const officeDrafts: Record<string, OfficeDraft> = {};
  for (const [oldFile, entry] of Object.entries(record(original.officeDrafts ?? {}))) {
    const fileId = ids.get(oldFile);
    const file = files.find((file) => file.id === fileId);
    const draft = validateOfficeDraft(entry);
    if (!file || !['word', 'excel', 'pdf'].includes(file.kind) || draft.kind !== file.kind)
      throw new Error('备份 Office 草稿的关联无效。');
    officeDrafts[file.id] = draft;
  }
  return {
    data: {
      schema: 1,
      files,
      threads,
      activeFile: files[0]?.id ?? null,
      author: text(original.author, 40),
      commentTargets: {},
      commentDrafts,
      editorDrafts,
      officeDrafts,
    },
    assets,
  };
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
