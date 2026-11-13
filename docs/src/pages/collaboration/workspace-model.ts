import type { OfficeDraft } from './office/office-model';
export type FileKind = 'text' | 'image' | 'pdf' | 'word' | 'excel' | 'binary';
export interface TextBlock {
  id: string;
  title: string;
  body: string;
}
export interface WorkspaceFile {
  id: string;
  name: string;
  kind: FileKind;
  mime: string;
  size: number;
  revision: number;
  blocks: TextBlock[];
  assetKey: string | null;
  updatedAt: string;
  bom?: boolean;
  sample?: boolean;
}
export interface Discussion {
  id: string;
  file: string;
  anchor: string | null;
  quote: string;
  quoteRevision: number | null;
  author: string;
  body: string;
  createdAt: string;
  resolved: boolean;
  replies: { id: string; author: string; body: string; createdAt: string }[];
}
export interface CommentTarget {
  anchor: string | null;
  replyTo: string | null;
}
export interface Workspace {
  schema: 1;
  files: WorkspaceFile[];
  activeFile: string | null;
  author: string;
  threads: Discussion[];
  commentTargets: Record<string, CommentTarget>;
  commentDrafts: Record<string, string>;
  editorDrafts: Record<string, { blockId: string; body: string; baseRevision: number }>;
  officeDrafts?: Record<string, OfficeDraft>;
}
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TEXT_BYTES = 1024 * 1024;
export const MAX_WORKSPACE_BYTES = 100 * 1024 * 1024;
export const MAX_FILES = 100;

export function validName(value: string): string {
  const name = value.trim();
  if (
    !name ||
    name.length > 180 ||
    /[/\\]/.test(name) ||
    [...name].some((char) => char.charCodeAt(0) < 32)
  ) {
    throw new Error('文件名需为 1–180 个字符，不能包含路径分隔符或控制字符。');
  }
  return name;
}
export function fileKind(name: string, mime: string): FileKind {
  if (
    /\.docx$/i.test(name) ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'word';
  if (
    /\.xlsx$/i.test(name) ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
    return 'excel';
  if (/\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i.test(name)) return 'image';
  if (/\.pdf$/i.test(name) || mime === 'application/pdf') return 'pdf';
  if (
    /\.(txt|md|mdx|json|csv|tsv|log|xml|html?|css|[cm]?js|jsx|tsx?|ya?ml|toml|ini|sql|py|sh)$/i.test(
      name
    ) ||
    mime.startsWith('text/')
  )
    return 'text';
  if (mime.startsWith('image/')) return 'image';
  return 'binary';
}
export function fileText(file: WorkspaceFile): string {
  return file.blocks.map((block) => block.body).join('\n\n');
}
export function textBlob(file: WorkspaceFile): Blob {
  return new Blob([file.bom ? '\ufeff' : '', fileText(file)], {
    type: file.mime || 'text/plain;charset=utf-8',
  });
}
export function fileType(file: WorkspaceFile): string {
  return file.name.includes('.') ? file.name.split('.').pop()!.toUpperCase().slice(0, 8) : 'FILE';
}
export function formatSize(size: number): string {
  return size < 1024
    ? `${size} B`
    : size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} KB`
      : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
export function createTextFile(name: string, body = ''): WorkspaceFile {
  return {
    id: crypto.randomUUID(),
    name: validName(name),
    kind: 'text',
    mime: 'text/plain;charset=utf-8',
    size: new Blob([body]).size,
    revision: 1,
    blocks: [{ id: crypto.randomUUID(), title: '正文', body }],
    assetKey: null,
    updatedAt: new Date().toISOString(),
  };
}
export async function importFile(source: File): Promise<{ file: WorkspaceFile; asset?: Blob }> {
  const name = validName(source.name);
  if (source.size > MAX_FILE_BYTES) throw new Error(`${name} 超过单文件 20 MB 上限。`);
  const kind = fileKind(name, source.type);
  if (kind === 'text') {
    if (source.size > MAX_TEXT_BYTES) throw new Error(`${name} 超过文本编辑 1 MB 上限。`);
    const buffer = await source.arrayBuffer();
    let body: string;
    try {
      body = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new Error(`${name} 不是 UTF-8 文本，请转换编码后再导入。`);
    }
    const file = createTextFile(name, body);
    file.mime = source.type || 'text/plain;charset=utf-8';
    const bytes = new Uint8Array(buffer);
    file.bom = bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191;
    file.size = source.size;
    return { file };
  }
  if (kind === 'pdf' && !/%PDF-\d\.\d/.test(await source.slice(0, 1024).text())) {
    throw new Error(`${name} 没有有效的 PDF 文件头，请检查文件格式。`);
  }
  const id = crypto.randomUUID();
  return {
    file: {
      id,
      name,
      kind,
      mime: source.type || 'application/octet-stream',
      size: source.size,
      revision: 1,
      blocks: [],
      assetKey: id,
      updatedAt: new Date().toISOString(),
    },
    asset: source,
  };
}
export function removeFile(workspace: Workspace, id: string): Workspace {
  const files = workspace.files.filter((file) => file.id !== id);
  return {
    ...workspace,
    files,
    activeFile: workspace.activeFile === id ? (files[0]?.id ?? null) : workspace.activeFile,
    threads: workspace.threads.filter((thread) => thread.file !== id),
    commentTargets: Object.fromEntries(
      Object.entries(workspace.commentTargets).filter(([key]) => key !== id)
    ),
    editorDrafts: Object.fromEntries(
      Object.entries(workspace.editorDrafts).filter(([key]) => key !== id)
    ),
    officeDrafts: Object.fromEntries(
      Object.entries(workspace.officeDrafts ?? {}).filter(([key]) => key !== id)
    ),
    commentDrafts: Object.fromEntries(
      Object.entries(workspace.commentDrafts).filter(([key]) => !key.startsWith(`${id}:`))
    ),
  };
}
