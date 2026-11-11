export interface ApiRow {
  /** 属性名 */
  name: string;
  /** 类型 */
  type: string;
  /** 默认值（无默认值显示 '—'） */
  defaultValue?: string;
  /** 说明 */
  description: string;
}

interface ApiTableProps {
  rows: ApiRow[];
}

/** Props API 表格：name / type / default / description（与 CONTRACTS.md §2 一致） */
export default function ApiTable({ rows }: ApiTableProps): React.ReactNode {
  return (
    <div
      className="doc-table-wrap doc-table-wrap--scroll-hint"
      role="region"
      aria-label="组件属性表，可横向滚动"
      tabIndex={0}
    >
      <table className="doc-api-table">
        <thead>
          <tr>
            <th scope="col">属性名</th>
            <th scope="col">类型</th>
            <th scope="col">默认值</th>
            <th scope="col">说明</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>
                <code className="doc-code-inline">{row.type}</code>
              </td>
              <td>
                <code className="doc-code-inline">{row.defaultValue ?? '—'}</code>
              </td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
