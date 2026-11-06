import { useState } from 'react';

interface CodeBlockProps {
  /** 代码文本 */
  code: string;
  /** 是否显示复制按钮（默认显示） */
  copyable?: boolean;
  /** 语言标签（可选，纯展示，如 'css' / 'json'；增量扩展，不影响既有用法） */
  language?: string;
}

/** 代码块：等宽 pre 展示（不引语法高亮库），可选一键复制 */
export default function CodeBlock({
  code,
  copyable = true,
  language,
}: CodeBlockProps): React.ReactNode {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // 非安全上下文回退：临时 textarea + execCommand
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={language ? 'doc-code-wrap doc-code-wrap--lang' : 'doc-code-wrap'}>
      {language ? <span className="doc-code-lang">{language}</span> : null}
      <pre className="doc-code">
        <code>{code}</code>
      </pre>
      {copyable ? (
        <button type="button" className="doc-copy-btn" onClick={handleCopy}>
          {copied ? '已复制' : '复制'}
        </button>
      ) : null}
    </div>
  );
}
