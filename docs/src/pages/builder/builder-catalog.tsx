import * as Z from '@zui/react';
import type { Config, SlotComponent } from '@puckeditor/core';
import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { BuilderFormContext, BuilderTabsContext } from './builder-form-context';
import { catalogDefinitions, type CatalogItem } from './builder-catalog-data';
import { BuilderDataField } from './BuilderDataField';
import { builderId, safeLink, safeImage, saveDownload } from './builder-model';

type Props = Record<string, unknown>;
const s = (p: Props, key: string, fallback = '') =>
  typeof p[key] === 'string' ? (p[key] as string) : fallback;
const n = (p: Props, key: string, fallback = 0) =>
  typeof p[key] === 'number' && Number.isFinite(p[key]) ? (p[key] as number) : fallback;
const b = (p: Props, key: string) => p[key] === true;
const list = (p: Props, key = 'items') => (Array.isArray(p[key]) ? p[key] : []) as CatalogItem[];
const split = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const pick = <const T extends readonly string[]>(p: Props, key: string, values: T): T[number] =>
  values.includes(p[key] as string) ? (p[key] as T[number]) : values[0];
const size = (p: Props) => pick(p, 'size', ['md', 'sm', 'lg'] as const);
const treeData = (items: CatalogItem[]): Z.TreeNode[] =>
  items.map((item) => ({
    key: item.value,
    title: item.label,
    disabled: item.disabled,
    children: item.children ? treeData(item.children) : undefined,
  }));
const linkTo = (href: unknown, document: Document = window.document) => {
  const safe = safeLink(href);
  if (!safe) return;
  if (safe.startsWith('#')) {
    const id = safe.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else document.defaultView?.scrollTo({ top: 0 });
  } else document.defaultView?.location.assign(safe);
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="z-builder-native-field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function CatalogSplitter({ p }: { p: Props }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stackOnMobile = b(p, 'stackOnMobile');
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    if (!stackOnMobile) {
      setStacked(false);
      return;
    }
    const area = rootRef.current?.closest<HTMLElement>('.z-builder-canvas');
    if (!area) return;
    const update = () => setStacked(area.clientWidth <= 600);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(area);
    return () => observer.disconnect();
  }, [stackOnMobile]);
  const items = list(p);
  const panels = Array.isArray(p._splitterPanels) ? (p._splitterPanels as ReactNode[]) : [];
  return (
    <Z.Splitter
      ref={rootRef}
      className="z-builder-responsive-splitter"
      data-mobile-stack={stackOnMobile || undefined}
      orientation={pick(p, 'orientation', ['horizontal', 'vertical'])}
      style={{ height: n(p, 'height', 280) }}
    >
      {(panels.length ? panels : items).map((panel, index) => {
        const item = items[index];
        return (
          <Z.Splitter.Panel
            key={index}
            label={item?.label || `面板 ${index + 1}`}
            collapsible={b(p, 'collapsible')}
            collapsed={stacked ? false : undefined}
            minSize={10}
          >
            <div className="z-builder-splitter-panel">
              {panels.length ? (
                (panel as ReactNode)
              ) : (
                <>
                  <strong>{item?.label}</strong>
                  <p>{item?.content}</p>
                </>
              )}
            </div>
          </Z.Splitter.Panel>
        );
      })}
    </Z.Splitter>
  );
}

/** All field adapters keep values in real controls and serialize non-native values into forms. */
function CatalogInput({ type, p }: { type: string; p: Props }) {
  const initial =
    type === 'DateRangePicker'
      ? s(p, 'start') && s(p, 'end')
        ? [s(p, 'start'), s(p, 'end')]
        : []
      : ['MultiCombobox', 'TreeSelect', 'Transfer', 'Cascader'].includes(type)
        ? split(s(p, 'defaultValue'))
        : ['Slider', 'Rate', 'InputNumber'].includes(type)
          ? n(p, 'defaultValue')
          : s(p, 'defaultValue');
  const [value, setValue] = useState<unknown>(initial);
  const label = s(p, 'label');
  const fieldName = s(p, 'name');
  const options = list(p, 'options');
  const inputId = `catalog-field-${s(p, 'id')}`;
  const stringValue = typeof value === 'string' ? value : '';
  const arrayValue = Array.isArray(value) ? (value as string[]) : [];
  const numberValue = typeof value === 'number' ? value : null;
  const common = { disabled: b(p, 'disabled'), size: size(p), 'aria-label': label || '选择内容' };
  let control: ReactNode;
  switch (type) {
    case 'Radio':
      control = (
        <Z.RadioGroup
          name={fieldName}
          value={stringValue}
          onChange={setValue}
          orientation={pick(p, 'orientation', ['horizontal', 'vertical'])}
        >
          {options.map((item) => (
            <Z.Radio
              key={item.value}
              value={item.value}
              label={item.label}
              disabled={common.disabled || item.disabled}
            />
          ))}
        </Z.RadioGroup>
      );
      break;
    case 'Select':
      control = (
        <div className="z-builder-select-control">
          <Z.Select
            {...common}
            options={options}
            value={stringValue}
            onChange={setValue}
            placeholder={s(p, 'placeholder')}
          />
          {b(p, 'clearable') && stringValue && (
            <Z.Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`清除${label}`}
              onClick={() => setValue('')}
            >
              清除
            </Z.Button>
          )}
        </div>
      );
      break;
    case 'Combobox':
      control = (
        <Z.Combobox
          {...common}
          options={options}
          value={stringValue}
          onChange={setValue}
          placeholder={s(p, 'placeholder')}
          clearable={b(p, 'clearable')}
        />
      );
      break;
    case 'MultiCombobox':
      control = (
        <Z.MultiCombobox
          {...common}
          options={options}
          value={arrayValue}
          onChange={setValue}
          placeholder={s(p, 'placeholder')}
          clearable={b(p, 'clearable')}
        />
      );
      break;
    case 'Slider':
      control = (
        <Z.Slider
          disabled={common.disabled}
          aria-label={common['aria-label']}
          min={n(p, 'min')}
          max={Math.max(n(p, 'min') + 1, n(p, 'max', 100))}
          step={Math.max(0.01, n(p, 'step', 1))}
          value={numberValue ?? 0}
          onChange={setValue}
        />
      );
      break;
    case 'Rate':
      control = (
        <Z.Rate
          disabled={common.disabled}
          aria-label={common['aria-label']}
          count={n(p, 'count', 5)}
          allowHalf={b(p, 'allowHalf')}
          value={numberValue ?? 0}
          onChange={setValue}
        />
      );
      break;
    case 'InputNumber':
      control = (
        <Z.InputNumber
          {...common}
          min={n(p, 'min')}
          max={Math.max(n(p, 'min'), n(p, 'max', 100))}
          step={Math.max(0.01, n(p, 'step', 1))}
          value={numberValue}
          onChange={setValue}
        />
      );
      break;
    case 'ColorPicker':
      control = <Z.ColorPicker {...common} value={stringValue || '#6366f1'} onChange={setValue} />;
      break;
    case 'DatePicker':
      control = (
        <div>
          <Z.DatePicker
            {...common}
            value={stringValue || undefined}
            onChange={(next) => setValue(next || '')}
            min={s(p, 'min') || undefined}
            max={s(p, 'max') || undefined}
          />
          {b(p, 'allowClear') && stringValue && (
            <Z.Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`清除${label}`}
              onClick={() => setValue('')}
            >
              清除
            </Z.Button>
          )}
        </div>
      );
      break;
    case 'DateRangePicker':
      control = (
        <Z.DateRangePicker
          {...common}
          value={arrayValue.length === 2 ? [arrayValue[0], arrayValue[1]] : null}
          onChange={(next) => setValue(next || [])}
          min={s(p, 'min') || undefined}
          max={s(p, 'max') || undefined}
          allowClear={b(p, 'allowClear')}
        />
      );
      break;
    case 'TimePicker':
      control = (
        <Z.TimePicker
          {...common}
          format={pick(p, 'format', ['HH:mm', 'HH:mm:ss'])}
          value={stringValue}
          onChange={setValue}
        />
      );
      break;
    case 'TreeSelect':
      control = (
        <Z.TreeSelect
          disabled={common.disabled}
          size={common.size}
          ariaLabel={common['aria-label']}
          data={treeData(options)}
          value={arrayValue}
          onChange={setValue}
          multiple={b(p, 'multiple')}
          placeholder={s(p, 'placeholder')}
        />
      );
      break;
    case 'Transfer':
      control = (
        <Z.Transfer
          dataSource={options.map((item) => ({
            key: item.value,
            title: item.label,
            disabled: common.disabled || item.disabled,
          }))}
          targetKeys={arrayValue}
          onChange={setValue}
          showSearch={b(p, 'showSearch')}
          titles={[s(p, 'sourceTitle'), s(p, 'targetTitle')]}
        />
      );
      break;
    case 'Cascader':
      control = (
        <Z.Cascader
          {...common}
          options={options}
          value={arrayValue}
          onChange={setValue}
          placeholder={s(p, 'placeholder')}
          showSearch
        />
      );
      break;
    case 'Mentions':
      control = (
        <Z.Mentions
          options={options}
          value={stringValue}
          onChange={setValue}
          disabled={common.disabled}
          placeholder={s(p, 'placeholder')}
          aria-label={common['aria-label']}
        />
      );
      break;
    default:
      control = null;
  }
  return (
    <Field label={label}>
      <div id={inputId}>{control}</div>
      {fieldName && type !== 'Radio' && (
        <input
          type="hidden"
          name={fieldName}
          value={Array.isArray(value) ? JSON.stringify(value) : String(value ?? '')}
        />
      )}
    </Field>
  );
}

function CatalogFormItem({ p, editing }: { p: Props; editing: boolean }) {
  const insideForm = useContext(BuilderFormContext);
  const options = list(p, 'options');
  const control = s(p, 'control');
  const props = { placeholder: s(p, 'placeholder'), 'aria-label': s(p, 'label') };
  const input =
    control === 'Select' ? (
      <Z.Select {...props} options={options} />
    ) : control === 'InputNumber' ? (
      <Z.InputNumber aria-label={props['aria-label']} />
    ) : control === 'Switch' ? (
      <Z.Switch
        checked={undefined}
        aria-label={s(p, 'label')}
        label={editing || !insideForm ? s(p, 'label') : undefined}
      />
    ) : control === 'Checkbox' ? (
      <Z.Checkbox
        checked={undefined}
        aria-label={s(p, 'label')}
        label={editing || !insideForm ? s(p, 'label') : undefined}
      />
    ) : control === 'DatePicker' ? (
      <Z.DatePicker aria-label={s(p, 'label')} />
    ) : control === 'TextArea' ? (
      <Z.Input.Textarea {...props} />
    ) : (
      <Z.Input {...props} />
    );
  if (editing || !insideForm)
    return (
      <Field label={`${s(p, 'label')}${b(p, 'required') ? ' *' : ''}`}>
        {input}
        {!insideForm && !editing && <small>请将此字段放入表单容器以参与提交。</small>}
      </Field>
    );
  return (
    <Z.Form.Item
      name={s(p, 'name') || s(p, 'id')}
      label={s(p, 'label')}
      required={b(p, 'required')}
    >
      {input}
    </Z.Form.Item>
  );
}

function CatalogTable({ p }: { p: Props }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: number }>();
  const rows = (Array.isArray(p.rows) ? p.rows : []) as Record<string, unknown>[];
  const columns = list(p, 'columns');
  const visible = rows.filter((row) =>
    Object.values(row).some((value) =>
      String(value ?? '')
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase())
    )
  );
  if (sort)
    visible.sort(
      (a, b) =>
        String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), 'zh-CN', {
          numeric: true,
        }) * sort.direction
    );
  return (
    <div className="z-builder-data-table">
      {b(p, 'searchable') && (
        <Z.Input
          aria-label={`搜索${s(p, 'caption') || '表格'}`}
          placeholder="搜索表格内容…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          clearable
        />
      )}
      <div className="z-builder-table-scroll">
        <Z.Table
          striped={b(p, 'striped')}
          density={s(p, 'size') === 'sm' ? 'compact' : 'comfortable'}
        >
          <caption>{s(p, 'caption')}</caption>
          <Z.Table.Head>
            <Z.Table.Row>
              {columns.map((item) => (
                <Z.Table.HeaderCell
                  key={item.value}
                  style={item.width ? { width: item.width } : undefined}
                  aria-sort={
                    sort?.key === item.value
                      ? sort.direction === 1
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSort({
                        key: item.value,
                        direction: sort?.key === item.value ? -sort.direction : 1,
                      })
                    }
                  >
                    {item.label}{' '}
                    <span aria-hidden="true">
                      {sort?.key === item.value ? (sort.direction === 1 ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                </Z.Table.HeaderCell>
              ))}
            </Z.Table.Row>
          </Z.Table.Head>
          <Z.Table.Body>
            {visible.map((row, index) => (
              <Z.Table.Row key={index}>
                {columns.map((column) => (
                  <Z.Table.Cell key={column.value}>{String(row[column.value] ?? '')}</Z.Table.Cell>
                ))}
              </Z.Table.Row>
            ))}
          </Z.Table.Body>
        </Z.Table>
        {!visible.length && <Z.Empty description="没有符合条件的数据" />}
      </div>
    </div>
  );
}

function CatalogUpload({ p, editing }: { p: Props; editing: boolean }) {
  const [files, setFiles] = useState<Z.UploadFile[]>([]);
  const [error, setError] = useState('');
  const server = s(p, 'mode') === 'server';
  const action = /^https?:\/\//i.test(s(p, 'action')) ? safeLink(p.action) : undefined;
  return (
    <div className="z-builder-upload">
      <Z.Upload
        name={s(p, 'name')}
        accept={s(p, 'accept')}
        multiple={b(p, 'multiple')}
        maxCount={n(p, 'maxCount', 5)}
        draggable={b(p, 'draggable')}
        disabled={b(p, 'disabled') || (server && !action)}
        action={server ? action : undefined}
        fileList={files}
        onChange={(info) => setFiles(info.fileList)}
        onRemove={(file) => {
          setFiles((current) => current.filter((entry) => entry.uid !== file.uid));
        }}
        beforeUpload={(file) => {
          if (editing) return false;
          if (file.size > n(p, 'maxSize', 10) * 1024 * 1024) {
            setError(`文件不能超过 ${n(p, 'maxSize', 10)} MB。`);
            return false;
          }
          setError('');
          if (server) return true;
          setFiles((current) =>
            [
              ...(b(p, 'multiple') ? current : []),
              { uid: builderId('file'), name: file.name, size: file.size, originFileObj: file },
            ].slice(-n(p, 'maxCount', 5))
          );
          return false;
        }}
      >
        <span>{s(p, 'label') || '选择文件'}</span>
      </Z.Upload>
      <p className="z-builder-control-note">
        {server
          ? action
            ? '文件将发送至配置的上传服务。'
            : '请先在属性中填写有效的 http/https 上传服务地址。'
          : '文件仅保留在当前页面会话中。提交表单会记录附件信息，可分别下载原文件。'}
      </p>
      {!server &&
        files.map((file) => (
          <Z.Button
            key={file.uid}
            variant="outline"
            size="sm"
            type="button"
            onClick={async () => {
              if (!file.originFileObj) return;
              try {
                const bytes = await file.originFileObj.arrayBuffer();
                saveDownload(new Blob([bytes], { type: file.originFileObj.type }), file.name);
              } catch {
                setError('原文件读取失败，请重新选择文件后下载。');
              }
            }}
          >
            下载 {file.name}
          </Z.Button>
        ))}
      <input
        type="hidden"
        name={s(p, 'name') || 'files'}
        value={JSON.stringify(
          files.map(({ name, size, status, response }) => ({
            name,
            size,
            status: server ? status : 'local',
            response,
          }))
        )}
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function FeedbackAction({ type, p, editing }: { type: string; p: Props; editing: boolean }) {
  const message = Z.useMessage();
  const notification = Z.useNotification();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const items = list(p);
  const variant = pick(p, 'variant', ['info', 'success', 'warning', 'error']);
  return (
    <div ref={triggerRef}>
      {type === 'Popconfirm' ? (
        <Z.Popconfirm
          title={s(p, 'title')}
          description={s(p, 'description')}
          okText={s(p, 'confirmText')}
          cancelText={s(p, 'cancelText')}
          onConfirm={() => {
            message.success(s(p, 'successMessage'));
            linkTo(p.href, triggerRef.current?.ownerDocument);
          }}
        >
          <Z.Button type="button">{s(p, 'label')}</Z.Button>
        </Z.Popconfirm>
      ) : (
        <Z.Button
          type="button"
          onClick={() => {
            if (editing) return;
            if (type === 'Message')
              message[variant]({
                content: s(p, 'text'),
                duration: n(p, 'duration', 3000),
                closable: true,
              });
            else if (type === 'Notification')
              notification[variant]({
                title: s(p, 'title'),
                description: s(p, 'text'),
                duration: n(p, 'duration', 4500),
                placement: pick(p, 'placement', [
                  'topRight',
                  'topLeft',
                  'bottomRight',
                  'bottomLeft',
                ]),
              });
            else setOpen(true);
          }}
        >
          {s(p, 'label')}
        </Z.Button>
      )}
      {type === 'CommandPalette' && (
        <Z.CommandPalette
          open={!editing && open}
          onOpenChange={setOpen}
          hotkey={false}
          placeholder={s(p, 'placeholder')}
          commands={items.map((item) => ({
            key: item.value,
            label: item.label,
            group: item.description,
            disabled: item.disabled,
            onSelect: () => linkTo(item.href, triggerRef.current?.ownerDocument),
          }))}
        />
      )}
      {type === 'Tour' && (
        <Z.Tour
          open={!editing && open}
          onOpenChange={setOpen}
          steps={items.map((item) => ({
            title: item.label,
            description: item.content,
            target: () => {
              const document = triggerRef.current?.ownerDocument;
              return (
                (item.href?.startsWith('#')
                  ? document?.getElementById(item.href.slice(1))
                  : null) || triggerRef.current
              );
            },
          }))}
        />
      )}
    </div>
  );
}

function Overlay({ type, p, editing }: { type: string; p: Props; editing: boolean }) {
  const [open, setOpen] = useState(false);
  const Content = p.content as SlotComponent;
  const contents = (
    <>
      {s(p, 'text') && <p>{s(p, 'text')}</p>}
      <Content className="z-builder-stack" minEmptyHeight={100} />
    </>
  );
  if (editing)
    return (
      <section className="z-builder-overlay-editor">
        <small>
          {type} · {s(p, 'label')}
        </small>
        <h3>{s(p, 'title')}</h3>
        {contents}
      </section>
    );
  if (type === 'Drawer')
    return (
      <Z.Drawer open={open} onOpenChange={setOpen}>
        <Z.Button type="button" onClick={() => setOpen(true)}>
          {s(p, 'label')}
        </Z.Button>
        <Z.Drawer.Content
          placement={pick(p, 'placement', ['right', 'left', 'top', 'bottom'])}
          size={n(p, 'size', 420)}
        >
          <Z.Drawer.Header>
            <Z.Drawer.Title>{s(p, 'title')}</Z.Drawer.Title>
            <Z.Drawer.Close />
          </Z.Drawer.Header>
          <Z.Drawer.Body>{contents}</Z.Drawer.Body>
        </Z.Drawer.Content>
      </Z.Drawer>
    );
  if (type === 'Popover')
    return (
      <Z.Popover>
        <Z.Popover.Trigger asChild>
          <Z.Button type="button">{s(p, 'label')}</Z.Button>
        </Z.Popover.Trigger>
        <Z.Popover.Content side={pick(p, 'side', ['bottom', 'top'])}>
          <h3>{s(p, 'title')}</h3>
          {contents}
        </Z.Popover.Content>
      </Z.Popover>
    );
  return (
    <Z.Modal open={open} onOpenChange={setOpen}>
      <Z.Button type="button" onClick={() => setOpen(true)}>
        {s(p, 'label')}
      </Z.Button>
      <Z.Modal.Content>
        <Z.Modal.Header>
          <Z.Modal.Title>{s(p, 'title')}</Z.Modal.Title>
          <Z.Modal.Close />
        </Z.Modal.Header>
        <Z.Modal.Body>{contents}</Z.Modal.Body>
      </Z.Modal.Content>
    </Z.Modal>
  );
}

function CatalogTabs({ p, editing }: { p: Props; editing: boolean }) {
  const Content = p.content as SlotComponent;
  const items = list(p);
  const [panels, setPanels] = useState<Record<string, string>>({});
  const register = useCallback((id: string, value: string) => {
    setPanels((current) => ({ ...current, [id]: value }));
    return () =>
      setPanels((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
  }, []);
  const custom = new Set([
    ...(Array.isArray(p._panelValues) ? (p._panelValues as string[]) : []),
    ...Object.values(panels),
  ]);
  return (
    <Z.Tabs
      defaultValue={s(p, 'defaultValue') || items[0]?.value}
      orientation={pick(p, 'orientation', ['horizontal', 'vertical'])}
    >
      <Z.Tabs.List aria-label="页面标签">
        {items.map((item) => (
          <Z.Tabs.Trigger key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </Z.Tabs.Trigger>
        ))}
      </Z.Tabs.List>
      {items
        .filter((item) => !custom.has(item.value))
        .map((item) => (
          <Z.Tabs.Panel key={item.value} value={item.value}>
            <p>{item.content}</p>
          </Z.Tabs.Panel>
        ))}
      <BuilderTabsContext.Provider value={{ register }}>
        <Content className="z-builder-tab-slots" minEmptyHeight={editing ? 100 : 0} />
      </BuilderTabsContext.Provider>
    </Z.Tabs>
  );
}
function CatalogTabPanel({ p, editing }: { p: Props; editing: boolean }) {
  const tabs = useContext(BuilderTabsContext);
  const register = tabs?.register;
  const value = s(p, 'value');
  const id = s(p, 'id');
  const Content = p.content as SlotComponent;
  useEffect(() => register?.(id, value), [register, id, value]);
  if (!editing && tabs)
    return (
      <Z.Tabs.Panel value={value}>
        <Content className="z-builder-stack" />
      </Z.Tabs.Panel>
    );
  return (
    <section className="z-builder-overlay-editor">
      <small>
        标签面板 · {value}
        {!tabs ? ' · 请将此面板放入 Tabs 容器' : ''}
      </small>
      <h3>{s(p, 'title')}</h3>
      <Content className="z-builder-stack" minEmptyHeight={100} />
    </section>
  );
}
function CatalogSegmented({ p }: { p: Props }) {
  const [value, setValue] = useState(s(p, 'defaultValue'));
  return (
    <div>
      <Z.Segmented
        aria-label={s(p, 'label') || '分段选项'}
        options={list(p, 'options')}
        value={value}
        onChange={setValue}
        size={size(p)}
        block={b(p, 'block')}
      />
      {s(p, 'name') && <input type="hidden" name={s(p, 'name')} value={value} />}
    </div>
  );
}

function CatalogSteps({ p }: { p: Props }) {
  const [current, setCurrent] = useState(n(p, 'current'));
  return (
    <Z.Steps
      items={list(p).map((item) => ({
        title: item.label,
        description: item.description,
        disabled: item.disabled,
      }))}
      current={current}
      onChange={setCurrent}
      direction={pick(p, 'direction', ['horizontal', 'vertical'])}
      size={pick(p, 'size', ['md', 'sm'])}
    />
  );
}

export function CatalogRender({
  type,
  p,
  editing,
}: {
  type: string;
  p: Props;
  editing: boolean;
}): ReactNode {
  const Content = p.content as SlotComponent;
  const items = list(p);
  if (
    [
      'Radio',
      'Select',
      'Combobox',
      'MultiCombobox',
      'Slider',
      'Rate',
      'InputNumber',
      'ColorPicker',
      'DatePicker',
      'DateRangePicker',
      'TimePicker',
      'TreeSelect',
      'Transfer',
      'Cascader',
      'Mentions',
    ].includes(type)
  )
    return <CatalogInput type={type} p={p} />;
  if (['Message', 'Notification', 'CommandPalette', 'Tour', 'Popconfirm'].includes(type))
    return <FeedbackAction type={type} p={p} editing={editing} />;
  if (['Modal', 'Drawer', 'Popover'].includes(type))
    return <Overlay type={type} p={p} editing={editing} />;
  switch (type) {
    case 'FormItem':
      return <CatalogFormItem p={p} editing={editing} />;
    case 'Upload':
      return <CatalogUpload p={p} editing={editing} />;
    case 'Row':
      return (
        <Content
          as={Z.Row}
          gutter={n(p, 'gutter')}
          justify={pick(p, 'justify', ['start', 'center', 'end', 'space-between', 'space-around'])}
          align={pick(p, 'align', ['top', 'middle', 'bottom'])}
          wrap={b(p, 'wrap')}
          minEmptyHeight={100}
        />
      );
    case 'Col':
      return (
        <Content
          as={Z.Col}
          className="z-builder-col-content"
          span={n(p, 'span', 12)}
          offset={0}
          minEmptyHeight={100}
        />
      );
    case 'Flex':
      return (
        <Content
          as={Z.Flex}
          vertical={b(p, 'vertical')}
          gap={n(p, 'gap')}
          justify={pick(p, 'justify', ['start', 'center', 'end', 'space-between', 'space-around'])}
          align={pick(p, 'align', ['stretch', 'start', 'center', 'end'])}
          wrap={b(p, 'wrap')}
          minEmptyHeight={100}
        />
      );
    case 'Space':
      return (
        <Content
          as={Z.Space}
          direction={pick(p, 'direction', ['horizontal', 'vertical'])}
          size={n(p, 'size')}
          wrap={b(p, 'wrap')}
          align={pick(p, 'align', ['start', 'center', 'end', 'baseline'])}
          minEmptyHeight={100}
        />
      );
    case 'Splitter':
      if (editing)
        return (
          <section className="z-builder-overlay-editor">
            <small>可调分栏 · 每个直接子组件对应一个面板，未放入组件时使用面板数据</small>
            <Content className="z-builder-splitter-slots" minEmptyHeight={120} />
          </section>
        );
      return <CatalogSplitter p={p} />;
    case 'ConfigProvider':
      return (
        <Z.ConfigProvider locale={s(p, 'locale') === 'en-US' ? Z.enUS : Z.zhCN}>
          <Content className="z-builder-stack" minEmptyHeight={100} />
        </Z.ConfigProvider>
      );
    case 'App':
      return (
        <Z.App>
          <Content className="z-builder-stack" minEmptyHeight={100} />
        </Z.App>
      );
    case 'Watermark':
      return (
        <Z.Watermark
          content={s(p, 'text')}
          rotate={n(p, 'rotate', -22)}
          gap={[n(p, 'gap', 100), n(p, 'gap', 100)]}
        >
          <Content className="z-builder-stack" minEmptyHeight={160} />
        </Z.Watermark>
      );
    case 'Affix':
      return editing ? (
        <div className="z-builder-affix-editor">
          <Content className="z-builder-stack" minEmptyHeight={80} />
        </div>
      ) : (
        <Z.Affix offsetTop={n(p, 'offsetTop')}>
          <Content className="z-builder-stack" />
        </Z.Affix>
      );
    case 'Tabs':
      return <CatalogTabs p={p} editing={editing} />;
    case 'TabPanel':
      return <CatalogTabPanel p={p} editing={editing} />;
    case 'Segmented':
      return <CatalogSegmented p={p} />;
    case 'Steps':
      return <CatalogSteps p={p} />;
    case 'Pagination':
      return (
        <Z.Pagination
          total={n(p, 'total')}
          pageSize={n(p, 'pageSize', 10)}
          defaultPage={n(p, 'defaultPage', 1)}
          showJumper={b(p, 'showJumper')}
          disabled={b(p, 'disabled')}
        />
      );
    case 'Breadcrumb':
      return (
        <Z.Breadcrumb separator={s(p, 'separator')}>
          {items.map((item) => (
            <Z.Breadcrumb.Item key={item.value} href={safeLink(item.href)}>
              {item.label}
            </Z.Breadcrumb.Item>
          ))}
        </Z.Breadcrumb>
      );
    case 'SideNav':
      return (
        <Z.SideNav
          sections={[
            {
              key: 'main',
              label: s(p, 'title'),
              items: items.map((item) =>
                item.children
                  ? {
                      key: item.value,
                      label: item.label,
                      children: item.children.map((child) => ({
                        key: child.value,
                        label: child.label,
                        href: safeLink(child.href) || '#',
                        disabled: child.disabled,
                      })),
                    }
                  : {
                      key: item.value,
                      label: item.label,
                      href: safeLink(item.href) || '#',
                      disabled: item.disabled,
                    }
              ),
            },
          ]}
          currentKey={s(p, 'currentKey')}
          collapsible={b(p, 'collapsible')}
          onNavigate={(_key, item, event) => {
            event.preventDefault();
            if (!editing) linkTo(item.href, event.currentTarget.ownerDocument);
          }}
        />
      );
    case 'Anchor':
      return (
        <Z.Anchor
          offsetTop={n(p, 'offsetTop')}
          style={s(p, 'direction') === 'horizontal' ? { display: 'flex', gap: 16 } : undefined}
          onClick={(event, item) => {
            event.preventDefault();
            if (!editing) linkTo(item.href, event.currentTarget.ownerDocument);
          }}
        >
          {items.map((item) => (
            <Z.Anchor.Link key={item.value} href={safeLink(item.href) || '#'} title={item.label} />
          ))}
        </Z.Anchor>
      );
    case 'Typography': {
      const props = {
        strong: b(p, 'strong'),
        italic: b(p, 'italic'),
        underline: b(p, 'underline'),
        mark: b(p, 'mark'),
        code: b(p, 'code'),
        type:
          s(p, 'type') === 'default'
            ? undefined
            : pick(p, 'type', ['secondary', 'success', 'warning', 'danger']),
      };
      return s(p, 'variant') === 'title' ? (
        <Z.Typography.Title
          {...props}
          level={Math.max(1, Math.min(5, n(p, 'level', 2))) as 1 | 2 | 3 | 4 | 5}
        >
          {s(p, 'text')}
        </Z.Typography.Title>
      ) : s(p, 'variant') === 'text' ? (
        <Z.Typography.Text {...props}>{s(p, 'text')}</Z.Typography.Text>
      ) : (
        <Z.Typography.Paragraph {...props} copyable={b(p, 'copyable')}>
          {s(p, 'text')}
        </Z.Typography.Paragraph>
      );
    }
    case 'Avatar':
      return (
        <Z.Avatar
          src={safeImage(p.src)}
          alt={s(p, 'alt')}
          size={n(p, 'size', 48)}
          shape={pick(p, 'shape', ['circle', 'square'])}
        >
          {s(p, 'text')}
        </Z.Avatar>
      );
    case 'Descriptions':
      return (
        <Z.Descriptions
          title={s(p, 'title')}
          column={n(p, 'column', 2)}
          bordered={b(p, 'bordered')}
          size={pick(p, 'size', ['md', 'sm'])}
        >
          {items.map((item) => (
            <Z.Descriptions.Item key={item.value} label={item.label} span={item.span}>
              {item.content}
            </Z.Descriptions.Item>
          ))}
        </Z.Descriptions>
      );
    case 'Statistic':
      return (
        <Z.Statistic
          title={s(p, 'title')}
          value={n(p, 'value')}
          precision={n(p, 'precision')}
          prefix={s(p, 'prefix')}
          suffix={s(p, 'suffix')}
        />
      );
    case 'Timeline':
      return (
        <Z.Timeline
          items={items.map((item) => ({
            key: item.value,
            label: item.description,
            children: (
              <>
                <strong>{item.label}</strong>
                <p>{item.content}</p>
              </>
            ),
          }))}
          mode={pick(p, 'mode', ['left', 'right', 'alternate'])}
          pending={s(p, 'pending') || undefined}
        />
      );
    case 'Table':
      return <CatalogTable p={p} />;
    case 'VirtualTable':
      return (
        <Z.VirtualTable
          data={(p.rows || []) as Record<string, unknown>[]}
          columns={list(p, 'columns').map((item) => ({
            key: item.value,
            title: item.label,
            width: item.width,
            render: (row: Record<string, unknown>) => String(row[item.value] ?? ''),
          }))}
          height={n(p, 'height', 280)}
          rowHeight={n(p, 'rowHeight', 44)}
        />
      );
    case 'Tree':
      return (
        <Z.Tree
          data={treeData(items)}
          checkable={b(p, 'checkable')}
          defaultExpandedKeys={split(s(p, 'defaultExpandedKeys'))}
        />
      );
    case 'Collapse':
      return (
        <Z.Collapse
          items={items.map((item) => ({
            key: item.value,
            label: item.label,
            children: <p>{item.content}</p>,
            disabled: item.disabled,
          }))}
          accordion={b(p, 'accordion')}
          defaultValue={split(s(p, 'defaultActiveKeys'))}
        />
      );
    case 'List':
      return (
        <Z.List
          items={items.map((item) => ({
            key: item.value,
            title: item.label,
            description: item.description,
            extra: item.content,
          }))}
          header={s(p, 'title')}
          footer={s(p, 'footer')}
          bordered={b(p, 'bordered')}
          size={pick(p, 'size', ['md', 'sm'])}
        />
      );
    case 'Calendar':
      return (
        <Z.Calendar
          defaultValue={s(p, 'defaultValue') || undefined}
          fullscreen={b(p, 'fullscreen')}
        />
      );
    case 'QRCode':
      return (
        <Z.QRCode
          value={s(p, 'value')}
          size={n(p, 'size', 160)}
          color={s(p, 'color')}
          bgColor={s(p, 'bgColor')}
          level={pick(p, 'level', ['L', 'M', 'Q', 'H'])}
        />
      );
    case 'Tooltip':
      return (
        <Z.Tooltip
          content={s(p, 'text')}
          placement={pick(p, 'placement', ['top', 'bottom', 'left', 'right'])}
          delay={n(p, 'delay', 200)}
        >
          <Z.Button type="button" variant="outline">
            {s(p, 'label')}
          </Z.Button>
        </Z.Tooltip>
      );
    case 'DropdownMenu':
      return (
        <Z.DropdownMenu>
          <Z.DropdownMenu.Trigger>{s(p, 'label')}</Z.DropdownMenu.Trigger>
          <Z.DropdownMenu.Content>
            {items.map((item) => (
              <Z.DropdownMenu.Item
                key={item.value}
                disabled={item.disabled}
                onSelect={() => {
                  if (!editing) linkTo(item.href);
                }}
              >
                {item.label}
              </Z.DropdownMenu.Item>
            ))}
          </Z.DropdownMenu.Content>
        </Z.DropdownMenu>
      );
    case 'Empty':
      return <Z.Empty description={s(p, 'description')} />;
    case 'Skeleton':
      return (
        <div>
          {b(p, 'avatar') && <Z.Skeleton circle width={48} height={48} active={b(p, 'active')} />}
          <Z.Skeleton lines={n(p, 'rows', 3)} active={b(p, 'active')} />
        </div>
      );
    case 'Spin':
      return (
        <Z.Spin spinning={b(p, 'spinning')} tip={s(p, 'tip')} size={size(p)}>
          <Content className="z-builder-stack" minEmptyHeight={100} />
        </Z.Spin>
      );
    case 'Result':
      return (
        <Z.Result
          status={pick(p, 'status', ['success', 'error', 'info', 'warning', '403', '404', '500'])}
          title={s(p, 'title')}
          subTitle={s(p, 'subTitle')}
          extra={<Content className="z-builder-stack" minEmptyHeight={editing ? 100 : 0} />}
        />
      );
    case 'BackTop':
      return editing ? (
        <Z.Button type="button" variant="outline">
          {s(p, 'text')} 回到顶部 · 滚动 {n(p, 'visibilityHeight')}px 后显示
        </Z.Button>
      ) : (
        <Z.BackTop visibilityHeight={n(p, 'visibilityHeight')}>{s(p, 'text')}</Z.BackTop>
      );
    case 'FloatButton':
      return editing ? (
        <Z.Button type="button" variant="outline">
          {s(p, 'text')} {s(p, 'description')}
        </Z.Button>
      ) : (
        <Z.FloatButton
          icon={s(p, 'text')}
          description={s(p, 'description')}
          shape={pick(p, 'shape', ['circle', 'square'])}
          type={pick(p, 'type', ['default', 'primary'])}
          onClick={() => linkTo(p.href)}
        />
      );
    default:
      throw new Error(`未实现组件适配：${type}`);
  }
}

export const catalogComponents: Config['components'] = Object.fromEntries(
  Object.entries(catalogDefinitions).map(([type, definition]) => [
    type,
    {
      label: definition.label,
      defaultProps: Object.fromEntries(
        Object.entries(definition.fields).map(([key, field]) => [key, field.value])
      ),
      fields: Object.fromEntries(
        Object.entries(definition.fields).map(([key, field]) => [
          key,
          field.kind === 'items' || field.kind === 'rows'
            ? {
                type: 'custom',
                label: field.label,
                render: ({
                  value,
                  onChange,
                  readOnly,
                }: {
                  value: unknown;
                  onChange: (value: unknown[]) => void;
                  readOnly?: boolean;
                }) => (
                  <BuilderDataField
                    value={value}
                    onChange={onChange}
                    readOnly={readOnly}
                    label={field.label}
                    kind={field.kind as 'items' | 'rows'}
                  />
                ),
              }
            : field.kind === 'boolean'
              ? {
                  type: 'radio',
                  label: field.label,
                  options: [
                    { label: '是', value: true },
                    { label: '否', value: false },
                  ],
                }
              : field.kind === 'select'
                ? {
                    type: 'select',
                    label: field.label,
                    options: field.options!.map((value) => ({ label: value, value })),
                  }
                : field.kind === 'number'
                  ? { type: 'number', label: field.label, min: field.min, max: field.max }
                  : { type: field.kind, label: field.label },
        ])
      ),
      render: (props) => {
        const defaults = Object.fromEntries(
          Object.entries(definition.fields).map(([key, field]) => [key, field.value])
        );
        const p = { ...defaults, ...props };
        const editing = props.puck.isEditing;
        const key = JSON.stringify(
          Object.fromEntries(
            Object.keys(definition.fields)
              .filter((field) => field !== 'content')
              .map((field) => [field, p[field]])
          )
        );
        return <CatalogRender key={key} type={type} p={p} editing={editing} />;
      },
    },
  ])
);

// A builder configuration decorates its own copies of these shared definitions.
for (const component of Object.values(catalogComponents)) Object.freeze(component);
