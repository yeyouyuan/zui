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
}

/** 演示容器：标题 + 描述 + 实时示例 + 代码块 */
export default function Demo({
  title,
  description,
  children,
  code,
  stack = false,
}: DemoProps): React.ReactNode {
  return (
    <section className="doc-demo">
      <div className="doc-demo-head">
        <h3 className="doc-demo-title">{title}</h3>
        {description ? <p className="doc-demo-desc">{description}</p> : null}
      </div>
      <div className={stack ? 'doc-demo-stage doc-demo-stage--stack' : 'doc-demo-stage'}>
        {children}
      </div>
      {code ? (
        <div className="doc-demo-code">
          <CodeBlock code={code} />
        </div>
      ) : null}
    </section>
  );
}
