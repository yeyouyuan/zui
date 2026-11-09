import { useId } from 'react';

import CodeBlock from './CodeBlock';

interface DemoProps {
  /** 演示标题 */
  title: string;
  /** 演示说明（可选） */
  description?: string;
  /** 实时示例 */
  children: React.ReactNode;
  /** 对应的示例代码 */
  code?: string;
  /** 示例区是否纵向堆排 */
  stack?: boolean;
  /** 为流程图等保留最小阅读宽度，提供可聚焦的滚动区。 */
  scroll?: boolean;
}

/** 演示容器：标题 + 描述 + 实时示例 + 代码块 */
export default function Demo({
  title,
  description,
  children,
  code,
  stack = false,
  scroll = false,
}: DemoProps): React.ReactNode {
  const titleId = useId();
  return (
    <section className="doc-demo" aria-labelledby={titleId}>
      <div className="doc-demo-head">
        <h3 className="doc-demo-title" id={titleId}>
          {title}
        </h3>
        {description ? <p className="doc-demo-desc">{description}</p> : null}
      </div>
      <div className={stack ? 'doc-demo-stage doc-demo-stage--stack' : 'doc-demo-stage'}>
        {scroll ? (
          <div className="doc-demo-scroll" role="region" aria-label={`${title}示例，可横向滚动`} tabIndex={0}>
            {children}
          </div>
        ) : children}
      </div>
      {code ? (
        <details className="doc-demo-code">
          <summary className="doc-demo-code-toggle">
            <span aria-hidden="true">&lt;/&gt;</span> 示例代码
            <span className="doc-demo-code-hint" aria-hidden="true">
              展开 / 收起
            </span>
          </summary>
          <CodeBlock code={code} language="tsx" />
        </details>
      ) : null}
    </section>
  );
}
