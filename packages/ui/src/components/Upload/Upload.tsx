'use client';

import * as React from 'react';
import { CheckCircle, Loading, Trash, XCircle } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './Upload.css';

/* ---------------------------------- 类型 ---------------------------------- */

/** 文件列表项（uid 组件生成，受控列表必须保留） */
export interface UploadFile {
  uid: string;
  name: string;
  /** 字节 */
  size?: number;
  status?: 'uploading' | 'success' | 'error';
  /** 0-100 */
  percent?: number;
  response?: unknown;
  error?: string;
  /** 原生 File（内部持有，不序列化） */
  originFileObj?: File;
}

export interface UploadChangeInfo {
  file: UploadFile;
  fileList: UploadFile[];
}

export interface CustomRequestOptions {
  file: File;
  onProgress: (percent: number) => void;
  onSuccess: (response?: unknown) => void;
  onError: (error: Error | string) => void;
}

export interface UploadProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'className' | 'onChange'
> {
  /** 上传 URL；与 customRequest 二选一 */
  action?: string;
  customRequest?: (options: CustomRequestOptions) => { abort?: () => void } | void;
  /** 默认 'post' */
  method?: string;
  /** 表单字段名，默认 'file' */
  name?: string;
  headers?: Record<string, string>;
  /** 附加表单数据 */
  data?: Record<string, unknown>;
  withCredentials?: boolean;
  /** 透传 input accept */
  accept?: string;
  /** 默认 false */
  multiple?: boolean;
  /** 超出时挤掉最旧 */
  maxCount?: number;
  disabled?: boolean;
  /** 拖拽区模式（默认 false 按钮模式） */
  draggable?: boolean;
  fileList?: UploadFile[];
  defaultFileList?: UploadFile[];
  onChange?: (info: UploadChangeInfo) => void;
  /** 返回 false 阻止移除 */
  onRemove?: (file: UploadFile) => boolean | Promise<boolean> | void;
  /** false = 完全跳过（不入列表、不触发 onChange） */
  beforeUpload?: (file: File, fileList: File[]) => boolean | Promise<boolean>;
  className?: string;
  classNames?: { root?: string; trigger?: string; list?: string; item?: string; dragzone?: string };
}

/* --------------------------------- 工具 ---------------------------------- */

let uidCounter = 0;
function genUid(): string {
  uidCounter += 1;
  return `z-upload-${uidCounter}`;
}

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/** size 可读格式：B / KB / MB */
function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/* --------------------------------- Upload -------------------------------- */

export function Upload(props: UploadProps) {
  const {
    action,
    customRequest,
    method = 'post',
    name: fieldName = 'file',
    headers,
    data,
    withCredentials = false,
    accept,
    multiple = false,
    maxCount,
    disabled = false,
    draggable = false,
    fileList: controlledFileList,
    defaultFileList,
    onChange,
    onRemove,
    beforeUpload,
    className,
    classNames,
    ref,
    ...rest
  } = props;

  const { locale } = useZuiConfig();

  /* ------------------------------ 列表状态 ------------------------------- */

  const [fileList, setFileList] = useControllableState<UploadFile[]>({
    value: controlledFileList,
    defaultValue: defaultFileList ?? [],
  });
  // 同一事件内连续变更时以镜像为准，避免受控模式下读到旧值
  const listRef = React.useRef(fileList);
  listRef.current = fileList;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  /** 更新单个文件并触发 onChange（每次状态变化都触发） */
  const patchFile = (uid: string, patch: Partial<UploadFile>) => {
    const prev = listRef.current;
    if (!prev.some((item) => item.uid === uid)) return;
    const next = prev.map((item) => (item.uid === uid ? { ...item, ...patch } : item));
    const file = next.find((item) => item.uid === uid) as UploadFile;
    listRef.current = next;
    setFileList(next);
    onChangeRef.current?.({ file, fileList: next });
  };

  /* ------------------------------ 上传引擎 ------------------------------- */

  const abortsRef = React.useRef(new Map<string, () => void>());

  // 卸载时中止全部在途上传
  React.useEffect(() => {
    const aborts = abortsRef.current;
    return () => {
      aborts.forEach((abort) => abort());
      aborts.clear();
    };
  }, []);

  const abortUpload = (uid: string) => {
    const abort = abortsRef.current.get(uid);
    if (abort) {
      abort();
      abortsRef.current.delete(uid);
    }
  };

  const doUpload = (file: File, item: UploadFile) => {
    const uid = item.uid;
    if (customRequest) {
      const handle = customRequest({
        file,
        onProgress: (percent) => patchFile(uid, { percent: clampPercent(percent) }),
        onSuccess: (response) => {
          abortsRef.current.delete(uid);
          patchFile(uid, { status: 'success', percent: 100, response });
        },
        onError: (error) => {
          abortsRef.current.delete(uid);
          patchFile(uid, {
            status: 'error',
            error: typeof error === 'string' ? error : error.message,
          });
        },
      });
      if (handle && typeof handle.abort === 'function') abortsRef.current.set(uid, handle.abort);
      return;
    }

    if (!action) return;
    const xhr = new XMLHttpRequest();
    xhr.open(method, action);
    if (withCredentials) xhr.withCredentials = true;
    if (headers) {
      for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.total > 0) {
        patchFile(uid, { percent: clampPercent((event.loaded / event.total) * 100) });
      }
    };
    xhr.onload = () => {
      abortsRef.current.delete(uid);
      if (xhr.status >= 200 && xhr.status < 300) {
        let response: unknown = xhr.responseText;
        try {
          response = JSON.parse(xhr.responseText);
        } catch {
          // 非 JSON 响应保留原始文本
        }
        patchFile(uid, { status: 'success', percent: 100, response });
      } else {
        patchFile(uid, { status: 'error', error: `HTTP ${xhr.status}` });
      }
    };
    xhr.onerror = () => {
      abortsRef.current.delete(uid);
      patchFile(uid, { status: 'error', error: 'Network error' });
    };
    const formData = new FormData();
    if (data) {
      for (const [key, value] of Object.entries(data)) formData.append(key, String(value));
    }
    formData.append(fieldName, file, file.name);
    xhr.send(formData);
    abortsRef.current.set(uid, () => xhr.abort());
  };

  /* ------------------------------ 选择与流转 ------------------------------ */

  const selectFiles = async (selected: File[]) => {
    if (disabled || selected.length === 0) return;

    // beforeUpload 校验：false = 完全跳过（不入列表、不触发 onChange）
    const accepted: File[] = [];
    for (const file of selected) {
      if (beforeUpload) {
        const keep = await beforeUpload(file, selected);
        if (keep === false) continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) return;

    const willUpload = Boolean(customRequest || action);
    const items: UploadFile[] = accepted.map((file) => ({
      uid: genUid(),
      name: file.name,
      size: file.size,
      status: willUpload ? 'uploading' : undefined,
      percent: 0,
      originFileObj: file,
    }));

    const prev = listRef.current;
    let next = [...prev, ...items];
    if (maxCount != null && maxCount > 0 && next.length > maxCount) {
      // 挤掉最旧
      next = next.slice(next.length - maxCount);
      const kept = new Set(next.map((item) => item.uid));
      for (const old of prev) {
        if (!kept.has(old.uid)) abortUpload(old.uid);
      }
    }

    listRef.current = next;
    setFileList(next);
    for (const item of items) {
      onChangeRef.current?.({ file: item, fileList: next });
    }

    // 仅上传仍留在列表中的文件
    if (willUpload) {
      const kept = new Set(next.map((item) => item.uid));
      for (const item of items) {
        if (kept.has(item.uid)) doUpload(item.originFileObj as File, item);
      }
    }
  };

  /* -------------------------------- 移除 --------------------------------- */

  const handleRemove = async (file: UploadFile) => {
    if (disabled) return;
    const allowed = await onRemove?.(file);
    if (allowed === false) return;
    abortUpload(file.uid);
    const prev = listRef.current;
    const next = prev.filter((item) => item.uid !== file.uid);
    if (next.length === prev.length) return;
    listRef.current = next;
    setFileList(next);
    onChangeRef.current?.({ file, fileList: next });
  };

  /* ------------------------------- 交互事件 ------------------------------- */

  const inputRef = React.useRef<HTMLInputElement>(null);
  const openDialog = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // 复位以支持重复选择同一文件
    event.target.value = '';
    if (files.length > 0) void selectFiles(files);
  };

  const [dragOver, setDragOver] = React.useState(false);
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) void selectFiles(files);
  };

  /* -------------------------------- 渲染 --------------------------------- */

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      data-part="input"
      className="z-upload-input"
      tabIndex={-1}
      aria-hidden="true"
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      onChange={handleInputChange}
    />
  );

  return (
    <div
      {...rest}
      ref={ref}
      data-part="root"
      className={cx('z-upload', classNames?.root, className)}
      data-disabled={disabled || undefined}
    >
      {draggable ? (
        <div
          data-part="dragzone"
          className={cx('z-upload-dragzone', classNames?.dragzone)}
          data-dragover={dragOver || undefined}
          data-disabled={disabled || undefined}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          onClick={(event) => {
            if (event.target !== inputRef.current) openDialog();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openDialog();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="z-upload-dragzone-text">{locale.upload.dragText}</span>
          {hiddenInput}
        </div>
      ) : (
        <span data-part="trigger" className={cx('z-upload-trigger', classNames?.trigger)}>
          <button
            type="button"
            className="z-upload-button"
            aria-label={locale.upload.text}
            disabled={disabled}
            onClick={openDialog}
          >
            {locale.upload.text}
          </button>
          {hiddenInput}
        </span>
      )}

      {fileList.length > 0 && (
        <ul data-part="list" role="list" className={cx('z-upload-list', classNames?.list)}>
          {fileList.map((file) => (
            <li
              key={file.uid}
              role="listitem"
              data-part="item"
              data-status={file.status}
              className={cx('z-upload-item', classNames?.item)}
            >
              <div className="z-upload-item-main">
                <span className="z-upload-item-icon" aria-hidden="true">
                  {file.status === 'uploading' && <Loading size={16} />}
                  {file.status === 'success' && <CheckCircle size={16} />}
                  {file.status === 'error' && <XCircle size={16} />}
                </span>
                <span className="z-upload-item-name" title={file.name}>
                  {file.name}
                </span>
                {typeof file.size === 'number' && (
                  <span className="z-upload-item-size">{formatSize(file.size)}</span>
                )}
                <button
                  type="button"
                  className="z-upload-item-remove"
                  aria-label={locale.upload.remove}
                  disabled={disabled}
                  onClick={() => void handleRemove(file)}
                >
                  <Trash size={14} aria-hidden="true" />
                </button>
              </div>
              {file.status === 'uploading' && (
                <span className="z-upload-item-progress" data-part="progress">
                  <span
                    className="z-upload-item-progress-fill"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={file.percent ?? 0}
                    style={{ width: `${file.percent ?? 0}%` }}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
