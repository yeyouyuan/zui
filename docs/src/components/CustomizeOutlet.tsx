interface CustomizeOutletProps {
  /** 组件名（如 'Button'） */
  name: string;
  /** data-part 清单（从组件源码 grep 提取） */
  parts: string[];
  /** 组件级 CSS 变量清单（--z-<name>-*） */
  vars: string[];
  /** 额外说明 */
  note?: string;
}

/** 「定制出口」小节：data-part 清单 + 组件级 CSS 变量清单 */
export default function CustomizeOutlet({
  name,
  parts,
  vars,
  note,
}: CustomizeOutletProps): React.ReactNode {
  return (
    <section>
      <h2 className="doc-h2">定制出口</h2>
      <p className="doc-p">
        {name} 提供三层定制出口：结构元素的 <code className="doc-code-inline">data-part</code>、
        slot 级 <code className="doc-code-inline">classNames</code> 追加、以及组件级 CSS 变量覆盖。
        请勿依赖内部类名（<code className="doc-code-inline">z-*</code>），它们不属于公开契约。
      </p>
      <h3 className="doc-h3">data-part 清单</h3>
      <ul className="doc-chip-list">
        {parts.map((part) => (
          <li className="doc-chip" key={part}>
            data-part=&quot;{part}&quot;
          </li>
        ))}
      </ul>
      <h3 className="doc-h3">CSS 变量（--z-{name.toLowerCase()}-*）</h3>
      <ul className="doc-chip-list">
        {vars.map((v) => (
          <li className="doc-chip" key={v}>
            {v}
          </li>
        ))}
      </ul>
      {note ? <p className="doc-p">{note}</p> : null}
    </section>
  );
}
