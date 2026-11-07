'use client';

import * as React from 'react';
import { CheckCircle, Copy } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './Typography.css';

/* ---------------------------------- 类型 ---------------------------------- */

/** type 只调色：secondary → --z-color-fg-muted；success/warning/danger → 同名语义色 */
export type TypographyType = 'secondary' | 'success' | 'warning' | 'danger';

/** copyable 对象配置：text 覆盖被复制内容（默认取 children 文本），onCopy 在复制成功后回调 */
export interface CopyConfig {
  text?: string;
  onCopy?: () => void;
}

/** Title / Paragraph / Text 共享的扩展属性（原生属性透传到各自根元素） */
export interface TypographyBaseProps {
  /** 只调色，不改语义（data-type 透传，CSS 侧映射语义令牌） */
  type?: TypographyType;
  /** 内容后渲染复制按钮；传对象可覆盖被复制内容并监听成功回调 */
  copyable?: boolean | CopyConfig;
  /** 删除线（Text 时渲染 <del>；Title/Paragraph 走 data-delete 样式） */
  delete?: boolean;
  /** slot 级类名追加：root 根元素、copy 复制按钮 */
  classNames?: { root?: string; copy?: string };
}

export interface TitleProps
  extends Omit<React.ComponentPropsWithRef<'h1'>, 'children'>,
    TypographyBaseProps {
  /** 标题级别 1-5 → 渲染 h1-h5（默认 1） */
  level?: 1 | 2 | 3 | 4 | 5;
  children?: React.ReactNode;
}

export interface ParagraphProps
  extends Omit<React.ComponentPropsWithRef<'p'>, 'children'>,
    TypographyBaseProps {
  /** 省略：true 折 1 行；{ rows: n } 用 -webkit-line-clamp 折 n 行 */
  ellipsis?: boolean | { rows: number };
  children?: React.ReactNode;
}

export interface TextProps
  extends Omit<React.ComponentPropsWithRef<'span'>, 'children'>,
    TypographyBaseProps {
  /** 行内代码 → <code> */
  code?: boolean;
  /** 键盘按键 → <kbd> */
  keyboard?: boolean;
  /** 高亮 → <mark> */
  mark?: boolean;
  /** 加粗（data-strong，走 --z-weight-semibold） */
  strong?: boolean;
  /** 下划线（data-underline） */
  underline?: boolean;
  children?: React.ReactNode;
}

/* --------------------------------- 内部工具 -------------------------------- */

/** 复制成功后的反馈时长（图标 Copy → CheckCircle，1.5s 后还原） */
const COPY_FEEDBACK_DURATION = 1500;

/** 递归提取 children 的纯文本（copyable 默认被复制内容） */
function getTextFromChildren(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextFromChildren).join('');
  if (React.isValidElement(node)) {
    return getTextFromChildren((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

/** navigator.clipboard 不可用或失败时的回退：隐藏 textarea + execCommand('copy') */
function fallbackCopyText(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok =
      typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/* -------------------------------- CopyButton ------------------------------- */

/**
 * 复制按钮：内容后渲染。
 * navigator.clipboard.writeText 优先，失败回退 textarea + execCommand；
 * 成功后短暂切换 CheckCircle（1.5s），title 更新并由 aria-live="polite" 节点播报。
 */
function CopyButton({
  text,
  onCopy,
  className,
}: {
  text: string;
  onCopy?: () => void;
  className?: string;
}) {
  const { locale } = useZuiConfig();
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timerRef.current), []);

  async function handleCopy() {
    let ok = false;
    try {
      // navigator.clipboard 优先
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    // 失败回退 textarea + execCommand('copy')
    if (!ok) ok = fallbackCopyText(text);
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
    onCopy?.();
  }

  return (
    <>
      <button
        type="button"
        data-part="copy"
        data-copied={copied ? 'true' : undefined}
        className={cx('z-typography-copy', className)}
        aria-label={locale.accessibility.copy}
        title={copied ? locale.accessibility.copied : undefined}
        onClick={handleCopy}
      >
        {copied ? (
          <CheckCircle className="z-typography-copy-icon" />
        ) : (
          <Copy className="z-typography-copy-icon" />
        )}
      </button>
      {copied ? (
        <span data-part="copy-feedback" aria-live="polite" className="z-typography-copy-feedback">
          {locale.accessibility.copied}
        </span>
      ) : null}
    </>
  );
}

/** copyable 展开为复制按钮（CopyConfig.text 覆盖默认的 children 文本） */
function renderCopy(
  copyable: boolean | CopyConfig | undefined,
  children: React.ReactNode,
  copyClassName?: string,
): React.ReactNode {
  if (!copyable) return null;
  const config = typeof copyable === 'object' ? copyable : {};
  return (
    <CopyButton
      text={config.text ?? getTextFromChildren(children)}
      onCopy={config.onCopy}
      className={copyClassName}
    />
  );
}

/* --------------------------------- 组件实现 -------------------------------- */

export function TypographyTitle({
  level = 1,
  type,
  copyable,
  delete: deleted,
  classNames,
  className,
  children,
  ref,
  ...rest
}: TitleProps) {
  // 级别防御：越界收敛到 1-5，避免渲染出 h0/h6 这类非法标签
  const safeLevel = Math.min(Math.max(level, 1), 5) as 1 | 2 | 3 | 4 | 5;
  const Tag = `h${safeLevel}` as 'h1';
  return (
    <Tag
      {...rest}
      ref={ref}
      data-part="root"
      data-type={type}
      data-delete={deleted ? 'true' : undefined}
      className={cx('z-typography', `z-typography-h${safeLevel}`, className, classNames?.root)}
    >
      {children}
      {renderCopy(copyable, children, classNames?.copy)}
    </Tag>
  );
}

export function TypographyParagraph({
  ellipsis,
  type,
  copyable,
  delete: deleted,
  classNames,
  className,
  style,
  children,
  ref,
  ...rest
}: ParagraphProps) {
  const isEllipsis = ellipsis === true || (typeof ellipsis === 'object' && ellipsis != null);
  const rows = typeof ellipsis === 'object' && ellipsis != null ? ellipsis.rows : 1;
  // 行数走内联 CSS 变量，由 .z-typography[data-ellipsis] 的 -webkit-line-clamp 消费
  const ellipsisStyle = isEllipsis
    ? ({ '--z-typography-ellipsis-rows': rows } as React.CSSProperties)
    : undefined;
  return (
    <p
      {...rest}
      ref={ref}
      data-part="root"
      data-type={type}
      data-delete={deleted ? 'true' : undefined}
      data-ellipsis={isEllipsis ? 'true' : undefined}
      style={{ ...ellipsisStyle, ...style }}
      className={cx('z-typography', 'z-typography-paragraph', className, classNames?.root)}
    >
      {children}
      {renderCopy(copyable, children, classNames?.copy)}
    </p>
  );
}

export function TypographyText({
  code,
  keyboard,
  mark,
  strong,
  underline,
  type,
  copyable,
  delete: deleted,
  classNames,
  className,
  children,
  ref,
  ...rest
}: TextProps) {
  // 语义标签切换：keyboard > code > mark > delete > span；组合态用 data-* 交叠样式
  const Tag = (keyboard ? 'kbd' : code ? 'code' : mark ? 'mark' : deleted ? 'del' : 'span') as
    | 'span';
  return (
    <Tag
      {...rest}
      ref={ref}
      data-part="root"
      data-type={type}
      data-code={code ? 'true' : undefined}
      data-keyboard={keyboard ? 'true' : undefined}
      data-mark={mark ? 'true' : undefined}
      data-strong={strong ? 'true' : undefined}
      data-underline={underline ? 'true' : undefined}
      data-delete={deleted ? 'true' : undefined}
      className={cx('z-typography', 'z-typography-text', className, classNames?.root)}
    >
      {children}
      {renderCopy(copyable, children, classNames?.copy)}
    </Tag>
  );
}

/* -------------------------------- Compound -------------------------------- */

export const Typography = {
  Title: TypographyTitle,
  Paragraph: TypographyParagraph,
  Text: TypographyText,
} as const;
