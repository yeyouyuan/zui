import { useEffect, useRef, useState } from 'react';
import {
  demoProjectSource,
  validateSources,
  type BuilderDataSource,
  type DataColumn,
} from './builder-data-sources';

/** A CSV reader that preserves quoted commas, embedded newlines and escaped quotes. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (!cell || quoted) quoted = !quoted;
      else cell += character;
    } else if (!quoted && (character === ',' || character === '\n')) {
      row.push(cell);
      cell = '';
      if (character === '\n') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else cell += character;
  }
  if (quoted) throw new Error('CSV 引号未闭合。');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function BuilderSourcesPanel({
  value = [],
  onChange,
  readOnly = false,
}: {
  value: BuilderDataSource[];
  onChange: (sources: BuilderDataSource[]) => void;
  readOnly?: boolean;
}) {
  const [selected, setSelected] = useState(value[0]?.id || '');
  const source = value.find((item) => item.id === selected) || value[0];
  const [draft, setDraft] = useState<BuilderDataSource | null>(
    source ? structuredClone(source) : null
  );
  const [raw, setRaw] = useState(source ? JSON.stringify(source.rows, null, 2) : '[]');
  const [message, setMessage] = useState('');
  const [json, setJson] = useState(false);
  const [testing, setTesting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(source ? structuredClone(source) : null);
    setRaw(source ? JSON.stringify(source.rows, null, 2) : '[]');
    setMessage('');
  }, [source]);
  const change = (patch: Partial<BuilderDataSource>) =>
    setDraft((current) => current && { ...current, ...patch });
  const add = (example: boolean) => {
    const id =
      example && !value.some((item) => item.id === 'projects')
        ? 'projects'
        : `data${Date.now().toString(36)}`;
    const next = example
      ? { ...structuredClone(demoProjectSource), id }
      : {
          id,
          name: '新数据源',
          mode: 'local' as const,
          endpoint: '',
          path: '',
          fields: [{ key: 'name', label: '名称', type: 'text' as const, required: true }],
          rows: [],
        };
    onChange([...value, next]);
    setSelected(id);
  };
  const save = () => {
    if (!draft) return;
    try {
      const clean = validateSources(
        value.map((item) =>
          item.id === source?.id ? { ...draft, rows: json ? JSON.parse(raw) : draft.rows } : item
        )
      );
      onChange(clean);
      setMessage('已应用。绑定此数据源的表格、图表和统计会同时更新。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '数据格式不正确。');
    }
  };
  const updateField = (index: number, patch: Partial<DataColumn>) => {
    if (!draft) return;
    const previous = draft.fields[index].key;
    change({
      fields: draft.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
      ...(patch.key && patch.key !== previous
        ? {
            rows: draft.rows.map((row) => {
              const next = { ...row, [patch.key!]: row[previous] ?? null };
              delete next[previous];
              return next;
            }),
          }
        : {}),
    });
  };
  return (
    <div className="studio-sources">
      <p className="studio-inspector-hint">
        同一页的统计、图表、列表和表单共用数据。先定义字段，再选择组件绑定。
      </p>
      <div className="studio-source-actions">
        <button type="button" disabled={readOnly || value.length >= 12} onClick={() => add(false)}>
          ＋ 新数据源
        </button>
        <button type="button" disabled={readOnly || value.length >= 12} onClick={() => add(true)}>
          加入示例数据
        </button>
      </div>
      {!!value.length && (
        <label className="studio-control">
          <span>当前数据源</span>
          <select
            aria-label="当前数据源"
            value={source?.id || ''}
            onChange={(event) => {
              setSelected(event.target.value);
              setJson(false);
            }}
          >
            {value.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {draft && (
        <fieldset disabled={readOnly}>
          <label className="studio-control">
            <span>显示名称</span>
            <input
              aria-label="数据源名称"
              value={draft.name}
              onChange={(event) => change({ name: event.target.value })}
            />
          </label>
          <p className="studio-inspector-hint">
            绑定 ID：<code>{draft.id}</code>
          </p>
          <label className="studio-control">
            <span>数据方式</span>
            <select
              aria-label="数据方式"
              value={draft.mode}
              onChange={(event) => change({ mode: event.target.value as 'local' | 'rest' })}
            >
              <option value="local">本地数据 · 可增删改</option>
              <option value="rest">REST API · 只读查询</option>
            </select>
          </label>
          {draft.mode === 'rest' && (
            <>
              <label className="studio-control">
                <span>GET 请求地址</span>
                <input
                  type="url"
                  placeholder="https://api.example.com/items"
                  value={draft.endpoint}
                  onChange={(event) => change({ endpoint: event.target.value })}
                />
              </label>
              <label className="studio-control">
                <span>数组结果路径</span>
                <input
                  placeholder="data.items，根数组留空"
                  value={draft.path}
                  onChange={(event) => change({ path: event.target.value })}
                />
              </label>
              <p className="studio-inspector-hint">
                在交互预览与导出页面中请求。接口需要允许浏览器跨域访问；编辑画布使用下方的设计样本。
              </p>
              <button
                type="button"
                disabled={testing || !draft.endpoint}
                onClick={async () => {
                  setTesting(true);
                  try {
                    const { parseApiRows } = await import('./builder-data-sources');
                    const checked = validateSources([draft])[0];
                    const response = await fetch(checked.endpoint, {
                      credentials: 'omit',
                      signal: AbortSignal.timeout(15000),
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const rows = parseApiRows(await response.json(), checked);
                    change({ rows });
                    setRaw(JSON.stringify(rows, null, 2));
                    setMessage(`连接成功，读取 ${rows.length} 条。点击应用保存为设计样本。`);
                  } catch (error) {
                    setMessage(
                      `连接失败：${error instanceof Error ? error.message : '请检查接口与跨域配置。'}`
                    );
                  } finally {
                    setTesting(false);
                  }
                }}
              >
                {testing ? '测试连接中…' : '测试连接并载入样本'}
              </button>
            </>
          )}
          <h3>字段结构</h3>
          {draft.fields.map((field, index) => (
            <div className="studio-source-field" key={index}>
              <div>
                <input
                  aria-label={`字段 ${index + 1} 标识`}
                  placeholder="字段标识"
                  value={field.key}
                  onChange={(event) => updateField(index, { key: event.target.value })}
                />
                <input
                  aria-label={`字段 ${index + 1} 名称`}
                  placeholder="显示名称"
                  value={field.label}
                  onChange={(event) => updateField(index, { label: event.target.value })}
                />
              </div>
              <div>
                <select
                  aria-label={`字段 ${index + 1} 类型`}
                  value={field.type}
                  onChange={(event) =>
                    updateField(index, { type: event.target.value as DataColumn['type'] })
                  }
                >
                  {Object.entries({
                    text: '文本',
                    number: '数字',
                    email: '邮箱',
                    date: '日期',
                    select: '单选',
                  }).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={!!field.required}
                    onChange={(event) => updateField(index, { required: event.target.checked })}
                  />
                  必填
                </label>
                <button
                  type="button"
                  aria-label={`删除字段 ${index + 1}`}
                  disabled={draft.fields.length <= 1}
                  onClick={() => change({ fields: draft.fields.filter((_, i) => i !== index) })}
                >
                  移除
                </button>
              </div>
              {field.type === 'select' && (
                <input
                  aria-label={`字段 ${index + 1} 选项`}
                  placeholder="选项，用 | 分隔"
                  value={(field.options || []).join('|')}
                  onChange={(event) =>
                    updateField(index, { options: event.target.value.split('|') })
                  }
                />
              )}
            </div>
          ))}
          <button
            type="button"
            disabled={draft.fields.length >= 20}
            onClick={() => {
              let suffix = draft.fields.length + 1;
              while (draft.fields.some((field) => field.key === `field${suffix}`)) suffix++;
              change({
                fields: [...draft.fields, { key: `field${suffix}`, label: '新字段', type: 'text' }],
              });
            }}
          >
            ＋ 添加字段
          </button>
          <h3>
            设计数据 <small>{draft.rows.length} / 1000 条</small>
          </h3>
          <div className="studio-source-actions">
            <button type="button" onClick={() => importRef.current?.click()}>
              导入 CSV / JSON
            </button>
            <button
              type="button"
              onClick={() => {
                if (json) {
                  try {
                    change({ rows: JSON.parse(raw) });
                    setJson(false);
                  } catch {
                    setMessage('JSON 格式不正确。');
                  }
                } else {
                  setRaw(JSON.stringify(draft.rows, null, 2));
                  setJson(true);
                }
              }}
            >
              {json ? '表格编辑' : 'JSON 编辑'}
            </button>
          </div>
          {json ? (
            <textarea
              className="studio-source-json"
              aria-label="数据源 JSON"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
            />
          ) : (
            <>
              <div className="studio-source-grid">
                <table>
                  <thead>
                    <tr>
                      {draft.fields.map((field) => (
                        <th key={field.key}>{field.label}</th>
                      ))}
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.rows.slice(0, 15).map((row, index) => (
                      <tr key={index}>
                        {draft.fields.map((field) => (
                          <td key={field.key}>
                            <input
                              aria-label={`数据第 ${index + 1} 行 ${field.label}`}
                              value={String(row[field.key] ?? '')}
                              type={field.type === 'number' ? 'number' : 'text'}
                              onChange={(event) =>
                                change({
                                  rows: draft.rows.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          [field.key]:
                                            field.type === 'number' && event.target.value !== ''
                                              ? Number(event.target.value)
                                              : event.target.value,
                                        }
                                      : r
                                  ),
                                })
                              }
                            />
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            aria-label={`移除第 ${index + 1} 条记录`}
                            onClick={() =>
                              change({ rows: draft.rows.filter((_, i) => i !== index) })
                            }
                          >
                            移除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {draft.rows.length > 15 && (
                <p className="studio-inspector-hint">
                  此处展示前 15 条，全部记录可在 JSON 中编辑。
                </p>
              )}
              <button
                type="button"
                disabled={draft.rows.length >= 1000}
                onClick={() =>
                  change({
                    rows: [
                      ...draft.rows,
                      Object.fromEntries([
                        ['_id', `row-${Date.now()}`],
                        ...draft.fields.map((field) => [
                          field.key,
                          field.type === 'number' ? 0 : '',
                        ]),
                      ]),
                    ],
                  })
                }
              >
                ＋ 添加记录
              </button>
            </>
          )}
          <div className="studio-source-apply">
            <button type="button" className="studio-primary-action" onClick={save}>
              应用数据源
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(value.filter((item) => item.id !== source?.id));
                setSelected('');
              }}
            >
              删除数据源
            </button>
          </div>
        </fieldset>
      )}
      {message && (
        <p role="status" className="studio-inspector-hint">
          {message}
        </p>
      )}
      <input
        type="file"
        hidden
        ref={importRef}
        accept=".json,.csv,application/json,text/csv"
        aria-label="导入数据文件"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file || !draft) return;
          try {
            if (file.size > 4 * 1024 * 1024) throw new Error('数据文件最多 4 MB。');
            const text = await file.text();
            const csv = file.name.toLowerCase().endsWith('.csv') ? readCsv(text) : null;
            const rows = csv
              ? csv.slice(1).map((cells) =>
                  Object.fromEntries(
                    draft.fields.map((field) => {
                      const index = csv[0].findIndex(
                        (header) => header === field.key || header === field.label
                      );
                      const cell = index >= 0 ? (cells[index] ?? '') : '';
                      if (field.type === 'number' && cell && !Number.isFinite(Number(cell)))
                        throw new Error(`字段 ${field.label} 包含非数字。`);
                      return [
                        field.key,
                        field.type === 'number' && cell !== '' ? Number(cell) : cell,
                      ];
                    })
                  )
                )
              : JSON.parse(text);
            const clean = validateSources([{ ...draft, rows }])[0];
            setDraft(clean);
            setRaw(JSON.stringify(clean.rows, null, 2));
            setMessage(`已载入 ${clean.rows.length} 条，点击应用保存。`);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : '导入失败。');
          }
        }}
      />
    </div>
  );
}
