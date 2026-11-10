import { useEffect, useRef, useState } from 'react';

interface CodeBlockProps {
  /** 代码文本 */
  code: string;
  /** 是否显示复制按钮（默认显示） */
  copyable?: boolean;
  /** 语言标签（可选，纯展示，如 'css' / 'json'；值为 'tsx' / 'jsx' 时启用内置简易语法高亮） */
  language?: string;
}

/** 代码内容始终按文本转义，只有高亮器自身生成的 span 可以成为 HTML。 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * JSX/TSX 简易语法高亮：纯正则 token 染色，返回可安全注入的 span.tok-* 片段。
 * 一次扫描字符串、注释、标签与关键字；每段原文只转义一次。
 * 不使用源码占位符，注释中的引号与源码中的 NUL 字符都不会损坏展示内容。
 */
export function highlightJsx(code: string): string {
  const tokens =
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\\r\n]|\\[\s\S])*"|'(?:[^'\\\r\n]|\\[\s\S])*'|`(?:[^`\\]|\\[\s\S])*`|<\/?[A-Za-z][\w.-]*|\b(?:import|from|export|default|const|let|function|return|if|else)\b/g;
  let result = '';
  let cursor = 0;
  for (const match of code.matchAll(tokens)) {
    const raw = match[0];
    const start = match.index;
    const cls = /^\/[/*]/.test(raw)
      ? 'tok-cmt'
      : /^["'`]/.test(raw)
        ? 'tok-str'
        : raw.startsWith('<')
          ? 'tok-tag'
          : 'tok-kw';
    result += escapeHtml(code.slice(cursor, start));
    result += `<span class="${cls}">${escapeHtml(raw)}</span>`;
    cursor = start + raw.length;
  }
  return result + escapeHtml(code.slice(cursor));
}

/** 剪贴板不可用或被拒绝时回退；失败不报告成功，临时节点总会清理。 */
export async function copyCodeText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 某些嵌入式浏览器提供 clipboard API，但会拒绝权限；仍尝试兼容回退。
  }
  const activeElement = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.setAttribute('aria-hidden', 'true');
  try {
    document.body.appendChild(textarea);
    textarea.select();
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (activeElement instanceof HTMLElement) activeElement.focus({ preventScroll: true });
  }
}

/** 带语言标记与复制反馈的代码块，明暗主题统一使用暗色代码表面。 */
export default function CodeBlock({
  code,
  copyable = true,
  language,
}: CodeBlockProps): React.ReactNode {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(resetTimer.current), []);
  // code 是文档站内的受控静态字符串（非用户输入），经 highlightJsx 完整转义后可安全注入
  const highlight = language === 'tsx' || language === 'jsx';

  const handleCopy = async () => {
    const ok = await copyCodeText(code);
    setCopyStatus(ok ? 'copied' : 'failed');
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const copyButton = copyable ? (
    <button type="button" className="doc-copy-btn" onClick={handleCopy} aria-live="polite">
      {copyStatus === 'copied' ? '已复制' : copyStatus === 'failed' ? '复制失败' : '复制'}
    </button>
  ) : null;

  return (
    <div className="doc-code-wrap">
      <div className="doc-code-toolbar">
        <span className="doc-code-lang">{language ?? 'text'}</span>
        {copyButton}
      </div>
      <pre className="doc-code" tabIndex={0}>
        {highlight ? (
          <code dangerouslySetInnerHTML={{ __html: highlightJsx(code) }} />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}
