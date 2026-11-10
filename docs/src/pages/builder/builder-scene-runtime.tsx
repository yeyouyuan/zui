import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Button, Input, Modal, Table, Tag } from '@zui/react';
import {
  Search,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Layers,
  Database,
  FileText,
  Settings,
  Menu,
  Close,
} from '@zui/icons';
import type { SlotComponent } from '@puckeditor/core';
import {
  normalizeRows,
  parseApiRows,
  type BuilderDataSource,
  type DataColumn,
  type DataRow,
} from './builder-data-sources';

type SourceState = { rows: DataRow[]; loading: boolean; error: string };
type DataContext = {
  sources: BuilderDataSource[];
  state: Record<string, SourceState>;
  mutate: (id: string, change: (rows: DataRow[]) => DataRow[]) => string;
  refresh: (id: string) => void;
};
const DataContext = createContext<DataContext>({
  sources: [],
  state: {},
  mutate: () => '请先配置数据源。',
  refresh: () => {},
});
export const BuilderEditorSelection = createContext<string[]>([]);
function fingerprint(text: string) {
  let hash = 0;
  for (const letter of text) hash = (Math.imul(31, hash) + letter.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
}

export function BuilderDataProvider({
  sources = [],
  editing = false,
  dataKey = '',
  children,
}: {
  sources?: BuilderDataSource[];
  editing?: boolean;
  dataKey?: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<Record<string, SourceState>>({});
  const [storageNotice, setStorageNotice] = useState('');
  const current = useRef(state);
  current.current = state;
  const requests = useRef(new Map<string, AbortController>());
  const signature = JSON.stringify(sources);
  const keyFor = (source: BuilderDataSource) =>
    `zui-builder-data:${dataKey || 'page'}:${source.id}:${fingerprint(JSON.stringify([source.fields, source.rows]))}`;
  const load = async (source: BuilderDataSource) => {
    requests.current.get(source.id)?.abort();
    const controller = new AbortController();
    requests.current.set(source.id, controller);
    const timer = setTimeout(() => controller.abort(), 15000);
    setState((previous) => ({
      ...previous,
      [source.id]: { rows: previous[source.id]?.rows || source.rows, loading: true, error: '' },
    }));
    try {
      if (!source.endpoint) throw new Error('请配置 API 地址。');
      const response = await fetch(source.endpoint, {
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = parseApiRows(await response.json(), source);
      if (requests.current.get(source.id) === controller)
        setState((previous) => ({ ...previous, [source.id]: { rows, loading: false, error: '' } }));
    } catch (error) {
      if (requests.current.get(source.id) === controller)
        setState((previous) => ({
          ...previous,
          [source.id]: {
            rows: [],
            loading: false,
            error: error instanceof Error ? error.message : '请求失败。',
          },
        }));
    } finally {
      clearTimeout(timer);
    }
  };
  useEffect(() => {
    const next: Record<string, SourceState> = {};
    for (const source of sources) {
      let rows = source.rows;
      if (!editing && source.mode === 'local') {
        try {
          const stored = localStorage.getItem(keyFor(source));
          if (stored) rows = normalizeRows(JSON.parse(stored), source.fields);
        } catch {
          /* Sandboxed previews retain data in this session. */
        }
      }
      next[source.id] = { rows, loading: false, error: '' };
    }
    current.current = next;
    setState(next);
    if (!editing)
      sources.filter((source) => source.mode === 'rest').forEach((source) => void load(source));
    const active = requests.current;
    return () => {
      active.forEach((request) => request.abort());
      active.clear();
    };
    // A serialized dependency avoids resetting runtime edits on unrelated parent renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, editing, dataKey]);
  const mutate = (id: string, change: (rows: DataRow[]) => DataRow[]) => {
    const source = sources.find((item) => item.id === id);
    if (!source || editing) return '请在交互预览中操作数据。';
    if (source.mode !== 'local') return 'REST 数据源只读，写入需要接入后端。';
    try {
      const rows = normalizeRows(change(current.current[id]?.rows || source.rows), source.fields);
      const next = { ...current.current, [id]: { rows, loading: false, error: '' } };
      current.current = next;
      setState(next);
      try {
        localStorage.setItem(keyFor(source), JSON.stringify(rows));
        setStorageNotice('');
      } catch {
        setStorageNotice(
          '当前环境不能持久保存运行数据，修改在本次会话内有效；可用列表的导出保存数据。'
        );
      }
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : '数据未能保存。';
    }
  };
  const refreshLatest = useRef({ sources, load, editing });
  refreshLatest.current = { sources, load, editing };
  useEffect(() => {
    const refresh = (event: Event) => {
      const context = refreshLatest.current;
      const source = context.sources.find(
        (item) => item.id === (event as CustomEvent<string>).detail
      );
      if (!context.editing && source?.mode === 'rest') void context.load(source);
    };
    document.addEventListener('zui-builder-refresh', refresh);
    return () => document.removeEventListener('zui-builder-refresh', refresh);
  }, []);
  return (
    <DataContext.Provider
      value={{
        sources,
        state,
        mutate,
        refresh: (id) => {
          const source = sources.find((item) => item.id === id);
          if (source?.mode === 'rest') void load(source);
        },
      }}
    >
      {children}
      {storageNotice && (
        <p className="z-builder-data-notice" role="status">
          {storageNotice}
        </p>
      )}
    </DataContext.Provider>
  );
}

function useSource(id: string) {
  const context = useContext(DataContext);
  const source = context.sources.find((item) => item.id === id);
  const state = context.state[id] || { rows: source?.rows || [], loading: false, error: '' };
  return { ...context, ...state, source };
}
function DataState({
  source,
  loading,
  error,
  retry,
}: {
  source?: BuilderDataSource;
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (!source)
    return (
      <div className="z-builder-data-empty">
        <Layers />
        <strong>连接一个数据源</strong>
        <span>在“数据”面板定义字段和记录，再在组件属性中选择。</span>
      </div>
    );
  if (loading)
    return (
      <div className="z-builder-data-empty" role="status">
        正在载入 {source.name}…
      </div>
    );
  if (error)
    return (
      <div className="z-builder-data-empty" role="alert">
        <strong>数据载入失败</strong>
        <span>{error}</span>
        <Button size="sm" variant="outline" onClick={retry}>
          重新请求
        </Button>
      </div>
    );
  return null;
}
function tone(value: unknown) {
  return /完成|通过|正常|published/i.test(String(value))
    ? 'success'
    : /待|暂停|pending/i.test(String(value))
      ? 'warning'
      : /失败|取消|error/i.test(String(value))
        ? 'error'
        : 'primary';
}
const numberText = (value: number) =>
  new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
function CellValue({ value, field }: { value: unknown; field: DataColumn }) {
  return field.type === 'select' && value ? (
    <Tag color={tone(value)}>{String(value)}</Tag>
  ) : (
    <>
      {field.type === 'number' && typeof value === 'number'
        ? numberText(value)
        : String(value ?? '—')}
    </>
  );
}
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: DataColumn;
  value: unknown;
  onChange: (value: string | number) => void;
}) {
  return (
    <label className="z-builder-record-field">
      <span>
        {field.label}
        {field.required && <em aria-hidden="true"> *</em>}
      </span>
      {field.type === 'select' ? (
        <select
          aria-label={field.label}
          name={field.key}
          required={field.required}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">请选择</option>
          {(field.options || []).map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <Input
          aria-label={field.label}
          name={field.key}
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'email'
                ? 'email'
                : field.type === 'date'
                  ? 'date'
                  : 'text'
          }
          step={field.type === 'number' ? 'any' : undefined}
          required={field.required}
          maxLength={10000}
          value={String(value ?? '')}
          onChange={(event) =>
            onChange(
              field.type === 'number' && event.target.value !== ''
                ? Number(event.target.value)
                : event.target.value
            )
          }
        />
      )}
    </label>
  );
}
const rowId = () =>
  `record-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
function downloadRows(rows: DataRow[], fields: DataColumn[], name: string) {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv =
    '\uFEFF' +
    [
      fields
        .map((field) => field.label)
        .map(cell)
        .join(','),
      ...rows.map((row) => fields.map((field) => cell(row[field.key])).join(',')),
    ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name || '数据'}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function SceneDataTable({
  title = '数据列表',
  source: id = '',
  columns = '',
  filterField = '',
  pageSize = 5,
  editable = true,
  searchable = true,
  downloadable = true,
  density = 'comfortable',
  editing = false,
}: {
  title?: string;
  source?: string;
  columns?: string;
  filterField?: string;
  pageSize?: number;
  editable?: boolean;
  searchable?: boolean;
  downloadable?: boolean;
  density?: 'comfortable' | 'compact';
  editing?: boolean;
}) {
  const data = useSource(id);
  const { source, rows, mutate } = data;
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: number }>({ key: '', direction: 1 });
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]);
  const [record, setRecord] = useState<DataRow | null>(null),
    [detail, setDetail] = useState<DataRow | null>(null);
  const [deleting, setDeleting] = useState<string[] | null>(null),
    [message, setMessage] = useState('');
  const columnKeys = columns
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  const fields =
    source?.fields.filter((field) => !columnKeys.length || columnKeys.includes(field.key)) || [];
  const filterColumn = source?.fields.find((field) => field.key === filterField);
  const canEdit = editable && source?.mode === 'local';
  const filtered = rows.filter(
    (row) =>
      (!query ||
        source?.fields.some((field) =>
          String(row[field.key] ?? '')
            .toLowerCase()
            .includes(query.toLowerCase())
        )) &&
      (!filter || String(row[filterField]) === filter)
  );
  if (sort.key)
    filtered.sort((a, b) => {
      const x = a[sort.key],
        y = b[sort.key];
      return (
        (typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x ?? '').localeCompare(String(y ?? ''), 'zh-CN', { numeric: true })) *
        sort.direction
      );
    });
  const size = Math.max(5, Math.min(100, Number(pageSize) || 5)),
    pages = Math.max(1, Math.ceil(filtered.length / size)),
    activePage = Math.min(page, pages);
  const visible = filtered.slice((activePage - 1) * size, activePage * size);
  useEffect(() => {
    setQuery('');
    setFilter('');
    setPage(1);
    setSelected([]);
    setRecord(null);
    setDetail(null);
  }, [id]);
  return (
    <section className="z-builder-surface z-builder-record-table">
      <div className="z-builder-section-head">
        <div>
          <h2>{title}</h2>
          <p>
            {source?.name || '未绑定数据'} · {rows.length} 条记录
          </p>
        </div>
        <div className="z-builder-inline-actions">
          {downloadable && (
            <Button
              size="sm"
              variant="outline"
              disabled={!source || editing || !filtered.length}
              onClick={() => source && downloadRows(filtered, fields, title)}
            >
              <Download />
              导出
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              disabled={editing}
              onClick={() => {
                setRecord({ _id: rowId() });
                setMessage('');
              }}
            >
              <Plus />
              新建记录
            </Button>
          )}
        </div>
      </div>
      {(searchable || filterColumn) && (
        <div className="z-builder-table-toolbar">
          {searchable && (
            <label className="z-builder-search">
              <Search />
              <input
                aria-label={`搜索${title}`}
                placeholder="搜索名称、负责人或关键词…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          )}
          {filterColumn && (
            <select
              aria-label={`筛选${filterColumn.label}`}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">全部{filterColumn.label}</option>
              {[...new Set(rows.map((row) => String(row[filterField] ?? '')).filter(Boolean))].map(
                (value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                )
              )}
            </select>
          )}
          {!!selected.length && canEdit && (
            <Button
              size="sm"
              variant="danger"
              disabled={editing}
              onClick={() => setDeleting(selected)}
            >
              删除所选 {selected.length} 条
            </Button>
          )}
        </div>
      )}
      <DataState {...data} retry={() => data.refresh(id)} />
      {source && !data.loading && !data.error && (
        <>
          <div className="z-builder-record-scroll">
            <Table density={density} striped={false}>
              <Table.Head>
                <Table.Row>
                  {canEdit && (
                    <Table.HeaderCell>
                      <input
                        type="checkbox"
                        aria-label="选择本页全部记录"
                        checked={
                          !!visible.length &&
                          visible.every((row) => selected.includes(String(row._id)))
                        }
                        disabled={editing}
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? [
                                  ...new Set([
                                    ...selected,
                                    ...visible.map((row) => String(row._id)),
                                  ]),
                                ]
                              : selected.filter((key) => !visible.some((row) => row._id === key))
                          )
                        }
                      />
                    </Table.HeaderCell>
                  )}
                  {fields.map((field) => (
                    <Table.HeaderCell key={field.key}>
                      <button
                        type="button"
                        aria-label={`按${field.label}排序`}
                        onClick={() =>
                          setSort({
                            key: field.key,
                            direction: sort.key === field.key ? -sort.direction : 1,
                          })
                        }
                      >
                        {field.label}
                        {sort.key === field.key ? (
                          sort.direction === 1 ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )
                        ) : (
                          <span className="z-builder-sort-idle">↕</span>
                        )}
                      </button>
                    </Table.HeaderCell>
                  ))}
                  <Table.HeaderCell>操作</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {visible.map((row) => (
                  <Table.Row key={String(row._id)}>
                    {canEdit && (
                      <Table.Cell>
                        <input
                          type="checkbox"
                          aria-label={`选择记录 ${String(row[fields[0]?.key] ?? row._id)}`}
                          checked={selected.includes(String(row._id))}
                          disabled={editing}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? [...selected, String(row._id)]
                                : selected.filter((key) => key !== row._id)
                            )
                          }
                        />
                      </Table.Cell>
                    )}
                    {fields.map((field, index) => (
                      <Table.Cell key={field.key}>
                        <span className={index === 0 ? 'z-builder-primary-cell' : ''}>
                          <CellValue value={row[field.key]} field={field} />
                        </span>
                      </Table.Cell>
                    ))}
                    <Table.Cell>
                      <div className="z-builder-row-actions">
                        <button type="button" disabled={editing} onClick={() => setDetail(row)}>
                          详情
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            disabled={editing}
                            onClick={() => {
                              setRecord({ ...row });
                              setMessage('');
                            }}
                          >
                            编辑
                          </button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
          {!visible.length && (
            <div className="z-builder-data-empty">
              没有匹配的记录。
              {(query || filter) && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setFilter('');
                  }}
                >
                  清除筛选
                </button>
              )}
            </div>
          )}
          <div className="z-builder-table-footer">
            <span>
              共 {filtered.length} 条{selected.length ? ` · 已选 ${selected.length} 条` : ''}
            </span>
            <div>
              <Button
                size="sm"
                variant="ghost"
                aria-label="上一页记录"
                disabled={activePage <= 1}
                onClick={() => setPage(activePage - 1)}
              >
                <ChevronLeft />
              </Button>
              <span>
                {activePage} / {pages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label="下一页记录"
                disabled={activePage >= pages}
                onClick={() => setPage(activePage + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
      {message && (
        <p className="z-builder-data-message" role="status">
          {message}
        </p>
      )}
      <Modal
        open={record !== null}
        onOpenChange={(open) => {
          if (!open) setRecord(null);
        }}
      >
        <Modal.Content size="md">
          <Modal.Header>
            <Modal.Title>
              {rows.some((row) => row._id === record?._id) ? '编辑记录' : '新建记录'}
            </Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            {record && source && (
              <form
                className="z-builder-record-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const error = mutate(id, (previous) =>
                    previous.some((row) => row._id === record._id)
                      ? previous.map((row) => (row._id === record._id ? record : row))
                      : [record, ...previous]
                  );
                  if (error) setMessage(error);
                  else {
                    setRecord(null);
                    setMessage('记录已保存，关联的统计和图表已更新。');
                  }
                }}
              >
                {source.fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={record[field.key]}
                    onChange={(value) => setRecord({ ...record, [field.key]: value })}
                  />
                ))}
                <div className="z-builder-inline-actions">
                  <Button type="button" variant="outline" onClick={() => setRecord(null)}>
                    取消
                  </Button>
                  <Button type="submit">保存记录</Button>
                </div>
              </form>
            )}
          </Modal.Body>
        </Modal.Content>
      </Modal>
      <Modal
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <Modal.Content size="md">
          <Modal.Header>
            <Modal.Title>记录详情</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            <dl className="z-builder-record-details">
              {source?.fields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>
                    <CellValue value={detail?.[field.key]} field={field} />
                  </dd>
                </div>
              ))}
            </dl>
            {canEdit && detail && (
              <Button variant="danger" onClick={() => setDeleting([String(detail._id)])}>
                删除记录
              </Button>
            )}
          </Modal.Body>
        </Modal.Content>
      </Modal>
      <Modal
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <Modal.Content size="sm">
          <Modal.Header>
            <Modal.Title>删除记录</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            确认删除这 {deleting?.length} 条记录？此操作只影响当前页面的本地运行数据。
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const error = mutate(id, (previous) =>
                  previous.filter((row) => !deleting?.includes(String(row._id)))
                );
                if (error) setMessage(error);
                else {
                  setSelected((previous) => previous.filter((key) => !deleting?.includes(key)));
                  setDetail(null);
                  setMessage('记录已删除。');
                }
                setDeleting(null);
              }}
            >
              确认删除
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </section>
  );
}

export function SceneMetric({
  title = '记录数量',
  source: id = '',
  operation = 'count',
  field = '',
  filterField = '',
  filterValue = '',
  prefix = '',
  suffix = '',
  caption = '',
}: {
  title?: string;
  source?: string;
  operation?: string;
  field?: string;
  filterField?: string;
  filterValue?: string;
  prefix?: string;
  suffix?: string;
  caption?: string;
}) {
  const data = useSource(id);
  const rows = data.rows.filter((row) => !filterField || String(row[filterField]) === filterValue);
  const numbers = rows
    .map((row) => row[field])
    .filter((value): value is number => typeof value === 'number');
  const value =
    operation === 'count'
      ? rows.length
      : operation === 'average'
        ? numbers.length
          ? numbers.reduce((a, b) => a + b, 0) / numbers.length
          : 0
        : numbers.reduce((a, b) => a + b, 0);
  return (
    <article className="z-builder-surface z-builder-metric">
      <span>{title}</span>
      <strong>
        {data.loading
          ? '…'
          : !data.source || data.error
            ? '—'
            : `${prefix}${numberText(value)}${suffix}`}
      </strong>
      <p>{data.error || caption || (data.source ? data.source.name : '请绑定数据源')}</p>
      <span className="z-builder-metric-mark">
        <Database />
      </span>
    </article>
  );
}

export function SceneChart({
  title = '数据分布',
  source: id = '',
  chart = 'bar',
  groupField = '',
  valueField = '',
  operation = 'count',
  height = 240,
}: {
  title?: string;
  source?: string;
  chart?: string;
  groupField?: string;
  valueField?: string;
  operation?: string;
  height?: number;
}) {
  const data = useSource(id),
    [showData, setShowData] = useState(false);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(650);
  const groups = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of data.rows) {
      const key = String(row[groupField] ?? '未分组');
      const value =
        operation === 'sum'
          ? typeof row[valueField] === 'number'
            ? (row[valueField] as number)
            : 0
          : 1;
      grouped.set(key, (grouped.get(key) || 0) + value);
    }
    return [...grouped.entries()].slice(0, 24);
  }, [data.rows, groupField, valueField, operation]);
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const measure = () => {
      if (plot.clientWidth) setPlotWidth(plot.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(plot);
    return () => observer.disconnect();
  }, [showData, chart, data.loading, data.error, groups.length]);
  const total = groups.reduce((sum, [, value]) => sum + Math.max(0, value), 0);
  const max = Math.max(1, ...groups.map(([, value]) => value)),
    min = Math.min(0, ...groups.map(([, value]) => value)),
    span = max - min;
  const colors = ['var(--z-color-primary)', '#5db8a7', '#e8ac58', '#95a5d9', '#cf8fba', '#79939e'];
  const axisText = (value: number) =>
    new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const plotLeft = Math.max(
    44,
    Math.min(76, Math.max(axisText(max).length, axisText(min).length) * 7 + 12)
  );
  const plotRight = plotWidth - 34;
  const plotTop = 24,
    plotBottom = height - 35;
  const plotX = (index: number) =>
    plotLeft + (index * (plotRight - plotLeft)) / Math.max(1, groups.length - 1);
  const plotY = (value: number) => plotTop + ((max - value) / span) * (plotBottom - plotTop);
  const labelStride = Math.ceil(
    groups.length / Math.max(2, Math.floor((plotRight - plotLeft) / 64))
  );
  const points = groups.map(([, value], index) => `${plotX(index)},${plotY(value)}`).join(' ');
  let offset = 0;
  return (
    <section className="z-builder-surface z-builder-chart">
      <div className="z-builder-section-head">
        <div>
          <h2>{title}</h2>
          <p>
            {operation === 'sum' ? '数值汇总' : '记录数量'} · {data.source?.name || '未绑定数据'}
          </p>
        </div>
        <button
          type="button"
          className="z-builder-quiet-button"
          aria-pressed={showData}
          onClick={() => setShowData(!showData)}
        >
          {showData ? '查看图表' : '查看数据'}
        </button>
      </div>
      <DataState {...data} retry={() => data.refresh(id)} />
      {data.source &&
        !data.loading &&
        !data.error &&
        (showData ? (
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>分组</Table.HeaderCell>
                <Table.HeaderCell>数值</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {groups.map(([key, value]) => (
                <Table.Row key={key}>
                  <Table.Cell>{key}</Table.Cell>
                  <Table.Cell>{numberText(value)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : !groups.length ? (
          <div className="z-builder-data-empty">暂无数据</div>
        ) : chart === 'donut' ? (
          <div className="z-builder-donut-layout" style={{ minHeight: height }}>
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-label={groups.map(([key, value]) => `${key} ${numberText(value)}`).join('；')}
            >
              <circle
                cx="100"
                cy="100"
                r="72"
                fill="none"
                stroke="var(--z-color-bg-muted)"
                strokeWidth="22"
              />
              {groups.map(([key, value], index) => {
                const length = total > 0 ? (Math.max(0, value) / total) * 452.389 : 0;
                const start = offset;
                offset += length;
                return (
                  <circle
                    key={key}
                    cx="100"
                    cy="100"
                    r="72"
                    fill="none"
                    stroke={colors[index % colors.length]}
                    strokeWidth="22"
                    strokeDasharray={`${length} 452.389`}
                    strokeDashoffset={-start}
                    transform="rotate(-90 100 100)"
                  />
                );
              })}
              <text x="100" y="99" textAnchor="middle" className="z-builder-donut-total">
                {numberText(total)}
              </text>
              <text x="100" y="121" textAnchor="middle" className="z-builder-chart-label">
                合计
              </text>
            </svg>
            <div className="z-builder-chart-legend">
              {groups.map(([key, value], index) => (
                <div key={key}>
                  <i style={{ background: colors[index % colors.length] }} />
                  <span>{key}</span>
                  <strong>{numberText(value)}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div ref={plotRef} className="z-builder-cartesian" style={{ height }}>
            <svg
              viewBox={`0 0 ${plotWidth} ${height}`}
              role="img"
              aria-label={groups.map(([key, value]) => `${key} ${numberText(value)}`).join('；')}
            >
              {[0, 1, 2, 3, 4].map((line) => (
                <g key={line}>
                  <line
                    x1={plotLeft}
                    x2={plotRight}
                    y1={plotTop + (line / 4) * (plotBottom - plotTop)}
                    y2={plotTop + (line / 4) * (plotBottom - plotTop)}
                    stroke="var(--z-color-border)"
                    strokeDasharray="3 5"
                  />
                  <text
                    x={plotLeft - 8}
                    y={plotTop + (line / 4) * (plotBottom - plotTop) + 4}
                    textAnchor="end"
                    className="z-builder-chart-label"
                  >
                    {axisText(max - (line / 4) * span)}
                  </text>
                </g>
              ))}
              {chart === 'line' ? (
                <>
                  <polyline
                    fill="none"
                    stroke="var(--z-color-primary)"
                    strokeWidth="3"
                    points={points}
                    vectorEffect="non-scaling-stroke"
                  />
                  {groups.map(([key, value], index) => (
                    <circle
                      key={key}
                      cx={plotX(index)}
                      cy={plotY(value)}
                      r="4"
                      fill="var(--z-color-primary)"
                    >
                      <title>
                        {key}：{numberText(value)}
                      </title>
                    </circle>
                  ))}
                </>
              ) : (
                groups.map(([key, value], index) => {
                  const width = (plotRight - plotLeft) / groups.length;
                  const barWidth = Math.min(60, width * 0.6);
                  return (
                    <rect
                      key={key}
                      x={plotLeft + index * width + (width - barWidth) / 2}
                      y={Math.min(plotY(value), plotY(0))}
                      width={barWidth}
                      height={Math.abs(plotY(value) - plotY(0))}
                      rx="5"
                      fill={colors[index % colors.length]}
                    >
                      <title>
                        {key}：{numberText(value)}
                      </title>
                    </rect>
                  );
                })
              )}
              {groups.map(
                ([key], index) =>
                  index % labelStride === 0 && (
                    <text
                      key={key}
                      x={
                        chart === 'line'
                          ? plotX(index)
                          : plotLeft + ((index + 0.5) * (plotRight - plotLeft)) / groups.length
                      }
                      y={height - 12}
                      textAnchor="middle"
                      className="z-builder-chart-label"
                    >
                      {key.slice(0, 6)}
                    </text>
                  )
              )}
            </svg>
          </div>
        ))}
      {groups.length >= 24 && <small>图表展示前 24 个分组。</small>}
    </section>
  );
}

export function SceneRecordForm({
  title = '创建新记录',
  source: id = '',
  submitLabel = '保存记录',
  successMessage = '保存成功，关联列表已更新。',
  columns = 2,
  editing = false,
}: {
  title?: string;
  source?: string;
  submitLabel?: string;
  successMessage?: string;
  columns?: number;
  editing?: boolean;
}) {
  const data = useSource(id),
    [values, setValues] = useState<DataRow>({}),
    [message, setMessage] = useState('');
  useEffect(() => {
    setValues({});
    setMessage('');
  }, [id]);
  return (
    <section className="z-builder-surface">
      <div className="z-builder-section-head">
        <div>
          <h2>{title}</h2>
          <p>{data.source?.name || '请先绑定数据源'}</p>
        </div>
      </div>
      <DataState {...data} retry={() => data.refresh(id)} />
      {data.source && (
        <form
          className="z-builder-record-form"
          onSubmit={(event) => {
            event.preventDefault();
            const error = data.mutate(id, (rows) => [{ ...values, _id: rowId() }, ...rows]);
            setMessage(error || successMessage);
            if (!error) setValues({});
          }}
        >
          <div
            className="z-builder-record-fields"
            style={{ '--record-columns': columns } as CSSProperties}
          >
            {data.source.fields.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(value) => setValues({ ...values, [field.key]: value })}
              />
            ))}
          </div>
          <Button type="submit" disabled={editing || data.source.mode !== 'local'}>
            {submitLabel}
          </Button>
          {data.source.mode === 'rest' && <p>此数据源为只读，保存需要接入后端。</p>}
        </form>
      )}
      {message && (
        <p className="z-builder-data-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

export function SceneRecordList({
  title = '内容集合',
  source: id = '',
  titleField = 'name',
  descriptionField = 'description',
  badgeField = 'status',
  layout = 'cards',
  columns = 3,
  searchable = true,
}: {
  title?: string;
  source?: string;
  titleField?: string;
  descriptionField?: string;
  badgeField?: string;
  layout?: string;
  columns?: number;
  searchable?: boolean;
}) {
  const data = useSource(id),
    [query, setQuery] = useState(''),
    [detail, setDetail] = useState<DataRow | null>(null);
  const rows = data.rows.filter((row) =>
    `${row[titleField] ?? ''} ${row[descriptionField] ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  return (
    <section className="z-builder-record-collection">
      <div className="z-builder-section-head">
        <div>
          <h2>{title}</h2>
          <p>{data.source?.name || '绑定数据源，将内容组成列表或卡片。'}</p>
        </div>
        {searchable && (
          <Input
            aria-label={`搜索${title}`}
            placeholder="搜索内容…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </div>
      <DataState {...data} retry={() => data.refresh(id)} />
      {data.source && !data.loading && !data.error && (
        <div
          className="z-builder-collection-grid"
          data-layout={layout}
          style={
            {
              '--collection-columns': Math.max(1, Math.min(6, Math.round(columns))),
            } as CSSProperties
          }
        >
          {rows.map((row) => (
            <button
              type="button"
              className="z-builder-surface z-builder-record-card"
              key={String(row._id)}
              onClick={() => setDetail(row)}
            >
              <span className="z-builder-record-icon">
                <FileText />
              </span>
              <span>
                {badgeField && row[badgeField] && (
                  <Tag color={tone(row[badgeField])}>{String(row[badgeField])}</Tag>
                )}
                <strong>{String(row[titleField] ?? '未命名')}</strong>
                <p>{String(row[descriptionField] ?? '')}</p>
                <small>查看详情 ↗</small>
              </span>
            </button>
          ))}
        </div>
      )}
      {data.source && !data.loading && !data.error && !rows.length && (
        <div className="z-builder-data-empty">没有匹配的内容</div>
      )}
      <Modal
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>{String(detail?.[titleField] ?? '内容详情')}</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Body>
            <dl className="z-builder-record-details">
              {data.source?.fields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>
                    <CellValue field={field} value={detail?.[field.key]} />
                  </dd>
                </div>
              ))}
            </dl>
          </Modal.Body>
        </Modal.Content>
      </Modal>
    </section>
  );
}

const ViewContext = createContext({ active: '', setActive: (_value: string) => {} });
const navigationIcons = [Database, Layers, FileText, Settings];
export function SceneAppShell({
  brand = 'Studio',
  subtitle = '团队工作空间',
  navigation = 'overview|工作概览\nprojects|项目管理\ncontent|内容中心',
  initialView = 'overview',
  layout = 'sidebar',
  sidebarWidth = 218,
  content: Content,
  editing = false,
}: {
  brand?: string;
  subtitle?: string;
  navigation?: string;
  initialView?: string;
  layout?: string;
  sidebarWidth?: number;
  content: SlotComponent;
  editing?: boolean;
}) {
  const [active, setActive] = useState(initialView),
    [menu, setMenu] = useState(false);
  useEffect(() => setActive(initialView), [initialView]);
  const items = navigation
    .split('\n')
    .filter(Boolean)
    .slice(0, 16)
    .map((line) => {
      const [value, label] = line.split('|');
      return { value: value.trim(), label: (label || value).trim() };
    });
  return (
    <ViewContext.Provider value={{ active, setActive }}>
      <div
        className="z-builder-app-shell"
        data-layout={layout}
        data-menu-open={menu || undefined}
        style={{ '--app-sidebar-width': `${sidebarWidth}px` } as CSSProperties}
      >
        <aside className="z-builder-app-sidebar">
          <div className="z-builder-app-brand">
            <span>{brand.slice(0, 1)}</span>
            <div>
              <strong>{brand}</strong>
              <small>{subtitle}</small>
            </div>
          </div>
          <div className="z-builder-app-space">
            页面导航 <span>工作空间</span>
          </div>
          <nav aria-label={`${brand}页面导航`}>
            {items.map((item, index) => {
              const Icon = navigationIcons[index % navigationIcons.length];
              return (
                <button
                  type="button"
                  key={item.value}
                  aria-current={active === item.value ? 'page' : undefined}
                  onClick={() => {
                    setActive(item.value);
                    setMenu(false);
                  }}
                >
                  <Icon />
                  {item.label}
                  {active === item.value && <i />}
                </button>
              );
            })}
          </nav>
          <div className="z-builder-app-sidebar-bottom">
            <span className="z-builder-app-avatar">U</span>
            <div>
              <strong>我的工作空间</strong>
              <small>本地应用 · 自由设计</small>
            </div>
          </div>
        </aside>
        <div className="z-builder-app-main">
          <header className="z-builder-app-topbar">
            <div>
              <button
                type="button"
                className="z-builder-app-menu"
                aria-label={menu ? '关闭应用菜单' : '展开应用菜单'}
                onClick={() => setMenu(!menu)}
              >
                {menu ? <Close /> : <Menu />}
              </button>
              <span>{brand}</span>
              <ChevronRight />
              <strong>{items.find((item) => item.value === active)?.label || '工作空间'}</strong>
            </div>
            <div>
              <span className="z-builder-app-status">
                <i />
                {editing ? '设计预览' : '工作空间'}
              </span>
              <span className="z-builder-app-avatar">U</span>
            </div>
          </header>
          <div className="z-builder-app-body">
            <Content className="z-builder-app-views" minEmptyHeight={360} />
          </div>
          <footer className="z-builder-app-footer">
            <span>
              {brand} / {subtitle}
            </span>
            <span>Built with ZUI</span>
          </footer>
        </div>
      </div>
    </ViewContext.Provider>
  );
}
export function SceneAppView({
  id,
  value = 'overview',
  title = '页面视图',
  content: Content,
  editing = false,
}: {
  id: string;
  value?: string;
  title?: string;
  content: SlotComponent;
  editing?: boolean;
}) {
  const { active, setActive } = useContext(ViewContext),
    selection = useContext(BuilderEditorSelection);
  const selected = selection.includes(id);
  useEffect(() => {
    if (editing && selected) setActive(value);
  }, [editing, selected, value, setActive]);
  return (
    <section
      className="z-builder-app-view"
      data-view={value}
      aria-label={title}
      hidden={!!active && active !== value}
    >
      <Content className="z-builder-stack" minEmptyHeight={200} />
    </section>
  );
}
