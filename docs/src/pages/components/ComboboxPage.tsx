import { useEffect, useRef, useState } from 'react';
import { Button, Combobox, Form } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

interface CityOption {
  value: string;
  label: React.ReactNode;
  textValue?: string;
  keywords?: string[];
  disabled?: boolean;
}

const CITY_OPTIONS: CityOption[] = [
  { value: 'beijing', label: '北京', keywords: ['Beijing', 'BJ'] },
  { value: 'shanghai', label: '上海', keywords: ['Shanghai', 'SH'] },
  { value: 'guangzhou', label: '广州', keywords: ['Guangzhou', 'GZ'] },
  { value: 'shenzhen', label: '深圳', keywords: ['Shenzhen', 'SZ'] },
  { value: 'hangzhou', label: '杭州', keywords: ['Hangzhou', 'HZ'] },
  { value: 'chengdu', label: '成都', keywords: ['Chengdu', 'CD'] },
  { value: 'wuhan', label: '武汉', keywords: ['Wuhan', 'WH'] },
  { value: 'xian', label: '西安（暂停选择）', textValue: '西安', disabled: true },
];

const BASIC_CODE = `<Combobox
  options={[
    { value: 'beijing', label: '北京', keywords: ['Beijing', 'BJ'] },
    { value: 'shanghai', label: '上海', keywords: ['Shanghai', 'SH'] },
    { value: 'shenzhen', label: '深圳', keywords: ['Shenzhen', 'SZ'] },
  ]}
  defaultValue="shanghai"
  clearable
  openOnFocus
  aria-label="城市"
/>`;

const CONTROLLED_CODE = `const [value, setValue] = useState<string | null>('shanghai');
const [inputValue, setInputValue] = useState('上海');
const [open, setOpen] = useState(false);

<Combobox
  options={cityOptions}
  value={value}
  inputValue={inputValue}
  open={open}
  onChange={(nextValue) => setValue(nextValue)}
  onInputValueChange={(nextInput) => setInputValue(nextInput)}
  onOpenChange={(nextOpen) => setOpen(nextOpen)}
  clearable
  aria-label="受控城市"
/>`;

const ASYNC_CODE = `const requestIdRef = useRef(0);
const controllerRef = useRef<AbortController | null>(null);
const debounceRef = useRef<number | undefined>(undefined);

const handleSearch = (query: string) => {
  window.clearTimeout(debounceRef.current);
  controllerRef.current?.abort();
  const requestId = ++requestIdRef.current;
  const controller = new AbortController();
  controllerRef.current = controller;

  debounceRef.current = window.setTimeout(async () => {
    setLoading(true);
    try {
      const nextOptions = await fetchCities(query, { signal: controller.signal });
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      setOptions(nextOptions);
    } finally {
      if (requestId === requestIdRef.current && !controller.signal.aborted) setLoading(false);
    }
  }, 250);
};

<Combobox
  options={options}
  filterOption={false}
  loading={loading}
  inputValue={query}
  onInputValueChange={setQuery}
  onSearch={handleSearch}
/>`;

const FORM_CODE = `<Form initialValues={{ city: null }} onFinish={(values) => console.log(values)}>
  <Form.Item
    name="city"
    label="常驻城市"
    required
    rules={[{ required: true, message: '请选择常驻城市' }]}
  >
    <Combobox options={cityOptions} clearable />
  </Form.Item>
  <Button type="submit" variant="primary">提交</Button>
</Form>`;

const VISUAL_CODE = `<Combobox options={cityOptions} size="sm" aria-label="小尺寸城市" />
<Combobox options={cityOptions} status="error" aria-label="错误态城市" />
<Combobox options={cityOptions} size="lg" status="success" defaultValue="beijing" aria-label="成功态城市" />
<Combobox options={cityOptions} defaultValue="shanghai" disabled aria-label="禁用城市" />`;

const FIELD_LABEL_STYLE: React.CSSProperties = {
  color: 'var(--z-color-fg-muted)',
  fontSize: 'var(--z-text-sm)',
  fontWeight: 'var(--z-weight-medium)',
};

function ControlledDemo(): React.ReactNode {
  const [value, setValue] = useState<string | null>('shanghai');
  const [inputValue, setInputValue] = useState('上海');
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'grid', gap: 'var(--z-space-3)', width: 'min(100%, 380px)' }}>
      <label htmlFor="combobox-controlled" style={FIELD_LABEL_STYLE}>
        受控城市
      </label>
      <Combobox
        id="combobox-controlled"
        options={CITY_OPTIONS}
        value={value}
        inputValue={inputValue}
        open={open}
        onChange={(nextValue) => setValue(nextValue)}
        onInputValueChange={(nextInput) => setInputValue(nextInput)}
        onOpenChange={(nextOpen) => setOpen(nextOpen)}
        clearable
        aria-label="受控城市"
      />
      <p className="doc-p" aria-live="polite">
        committed value：<code className="doc-code-inline">{value ?? 'null'}</code>；open：
        <code className="doc-code-inline">{String(open)}</code>
      </p>
      <label htmlFor="combobox-readonly" style={FIELD_LABEL_STYLE}>
        只读城市
      </label>
      <Combobox
        id="combobox-readonly"
        options={CITY_OPTIONS}
        defaultValue="beijing"
        readOnly
        aria-label="只读城市"
      />
    </div>
  );
}

function requestCities(query: string, signal: AbortSignal): Promise<CityOption[]> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      if (query.toLowerCase() === 'error') {
        reject(new Error('模拟远程搜索失败'));
        return;
      }
      const normalized = query.toLocaleLowerCase();
      resolve(
        CITY_OPTIONS.filter((option) => {
          if (option.disabled) return false;
          const text = typeof option.label === 'string' ? option.label : (option.textValue ?? '');
          return [text, option.value, ...(option.keywords ?? [])].some((candidate) =>
            candidate.toLocaleLowerCase().includes(normalized)
          );
        })
      );
    }, 550);

    function handleAbort() {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

function AsyncDemo(): React.ReactNode {
  const [query, setQuery] = useState('');
  const [value, setValue] = useState<string | null>(null);
  const [options, setOptions] = useState<CityOption[]>(CITY_OPTIONS.slice(0, 5));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      window.clearTimeout(debounceRef.current);
    },
    []
  );

  const handleSearch = (nextQuery: string) => {
    window.clearTimeout(debounceRef.current);
    controllerRef.current?.abort();
    const requestId = ++requestIdRef.current;

    if (nextQuery === '') {
      setOptions(CITY_OPTIONS.slice(0, 5));
      setLoading(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError('');

    debounceRef.current = window.setTimeout(async () => {
      try {
        const nextOptions = await requestCities(nextQuery, controller.signal);
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        setOptions(nextOptions);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        setOptions([]);
        setError('搜索失败，请稍后重试');
      } finally {
        if (requestId === requestIdRef.current && !controller.signal.aborted) setLoading(false);
      }
    }, 250);
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--z-space-3)', width: 'min(100%, 380px)' }}>
      <label htmlFor="combobox-async" style={FIELD_LABEL_STYLE}>
        远程搜索城市
      </label>
      <Combobox
        id="combobox-async"
        options={options}
        filterOption={false}
        loading={loading}
        value={value}
        inputValue={query}
        onChange={(nextValue) => setValue(nextValue)}
        onInputValueChange={(nextQuery, details) => {
          setQuery(nextQuery);
          if (details.reason === 'clear') handleSearch('');
        }}
        onSearch={handleSearch}
        loadingContent="正在搜索城市…"
        emptyContent="没有匹配城市"
        errorContent={error || null}
        clearable
        openOnFocus
        aria-label="远程搜索城市"
      />
      <p className="doc-p" aria-live="polite">
        已选：<code className="doc-code-inline">{value ?? '未选择'}</code>
        ；输入 <code className="doc-code-inline">error</code> 可查看错误态。
      </p>
    </div>
  );
}

function VisualStatesDemo(): React.ReactNode {
  const fields = [
    {
      id: 'combobox-size-sm',
      label: '小尺寸',
      control: <Combobox id="combobox-size-sm" options={CITY_OPTIONS} size="sm" />,
    },
    {
      id: 'combobox-status-error',
      label: '错误状态',
      control: (
        <Combobox
          id="combobox-status-error"
          options={CITY_OPTIONS}
          status="error"
          aria-describedby="combobox-status-error-help"
        />
      ),
      help: (
        <span id="combobox-status-error-help" style={{ color: 'var(--z-color-danger)' }}>
          请选择一个有效城市
        </span>
      ),
    },
    {
      id: 'combobox-size-lg',
      label: '大尺寸成功状态',
      control: (
        <Combobox
          id="combobox-size-lg"
          options={CITY_OPTIONS}
          size="lg"
          status="success"
          defaultValue="beijing"
        />
      ),
    },
    {
      id: 'combobox-disabled',
      label: '禁用状态',
      control: (
        <Combobox id="combobox-disabled" options={CITY_OPTIONS} defaultValue="shanghai" disabled />
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 'var(--z-space-5)', width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 'var(--z-space-4)',
          width: '100%',
        }}
      >
        {fields.map((field) => (
          <div
            key={field.id}
            style={{ display: 'grid', alignContent: 'start', gap: 'var(--z-space-2)' }}
          >
            <label htmlFor={field.id} style={FIELD_LABEL_STYLE}>
              {field.label}
            </label>
            {field.control}
            {field.help ? <span style={{ fontSize: 'var(--z-text-xs)' }}>{field.help}</span> : null}
          </div>
        ))}
      </div>

      <ul className="doc-kbd-row" aria-label="Combobox 键盘操作">
        <li>
          <span className="doc-kbd">↑</span> <span className="doc-kbd">↓</span> 打开并移动活动项
        </li>
        <li>
          <span className="doc-kbd">Enter</span> 选择可用项
        </li>
        <li>
          <span className="doc-kbd">Esc</span> 关闭并恢复 committed 文本
        </li>
        <li>
          <span className="doc-kbd">Tab</span> 离开时严格回退，不提交活动项
        </li>
      </ul>
    </div>
  );
}

function FormDemo(): React.ReactNode {
  const [result, setResult] = useState('');

  return (
    <Form
      initialValues={{ city: null }}
      onFinish={(values: Record<string, unknown>) => setResult(`提交成功：${String(values.city)}`)}
      onFinishFailed={(errors: Record<string, string>) =>
        setResult(`校验失败：${Object.values(errors).join('；')}`)
      }
      style={{ width: 'min(100%, 420px)' }}
    >
      <Form.Item
        name="city"
        label="常驻城市"
        required
        rules={[{ required: true, message: '请选择常驻城市' }]}
      >
        <Combobox options={CITY_OPTIONS} clearable placeholder="输入关键词后选择" />
      </Form.Item>
      <Button type="submit" variant="primary">
        提交
      </Button>
      {result ? (
        <p className="doc-p" aria-live="polite">
          {result}
        </p>
      ) : null}
    </Form>
  );
}

export default function ComboboxPage(): React.ReactNode {
  usePageTitle('Combobox 自动完成');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Combobox 自动完成</h1>
      <p className="doc-lead">
        单选、可编辑、严格选项型输入控件。输入文本只用于搜索，只有明确选择 option 才会更新 committed
        value；支持本地过滤、外部异步结果、IME、Form 与完整键盘导航。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="本地过滤"
        description="默认匹配 textValue、字符串 label、value 与 keywords；输入不会提前清空最后提交值，Esc、Tab 或真实失焦会执行严格回退。"
        code={BASIC_CODE}
        stack
      >
        <Combobox
          options={CITY_OPTIONS}
          defaultValue="shanghai"
          clearable
          openOnFocus
          aria-label="城市"
          style={{ width: 'min(100%, 380px)' }}
        />
      </Demo>

      <Demo
        title="三状态受控与只读"
        description="value、inputValue 与 open 可分别受控；父级未确认新 value 时不会乐观显示候选 label。readOnly 仍可聚焦复制，但不会打开、导航或选择。"
        code={CONTROLLED_CODE}
        stack
      >
        <ControlledDemo />
      </Demo>

      <Demo
        title="外部异步搜索"
        description="onInputValueChange 始终同步文本，onSearch 仅在非组合输入或 compositionend 后触发。示例用 250ms debounce、AbortController 与单调 request id 同时防止竞态；loading 时旧结果可浏览但不可提交，错误时清空旧结果避免误选。"
        code={ASYNC_CODE}
        stack
      >
        <AsyncDemo />
      </Demo>

      <Demo
        title="尺寸、状态与键盘"
        description="三档尺寸沿用 Input 的高度体系；error / success、disabled 与键盘提示放在同一验收面板，便于比较焦点、边框和长文案布局。"
        code={VISUAL_CODE}
        stack
      >
        <VisualStatesDemo />
      </Demo>

      <Demo
        title="Form committed value"
        description="Form.Item 收集的是明确选择的 option value，不是搜索草稿；required 校验也依据 committed value。"
        code={FORM_CODE}
        stack
      >
        <FormDemo />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'options',
            type: 'readonly ComboboxOption[]',
            description: '选项列表；value 必须唯一，复杂 label 必须提供 textValue。',
          },
          {
            name: 'value / defaultValue',
            type: 'string | null',
            description: '受控 / 非受控 committed option value。',
          },
          {
            name: 'onChange',
            type: '(value, option, details) => void',
            description: '明确选择或 clear 时触发；输入草稿不会触发。',
          },
          {
            name: 'inputValue / defaultInputValue',
            type: 'string',
            description: '受控 / 非受控输入文本。',
          },
          {
            name: 'onInputValueChange',
            type: '(text, { reason, isComposing }) => void',
            description: '文本同步回调；IME 组合中仍会触发。',
          },
          {
            name: 'onSearch',
            type: '(query: string) => void',
            description: '非组合输入或 compositionend 后触发，适合外部搜索副作用。',
          },
          {
            name: 'open / defaultOpen',
            type: 'boolean',
            description: '受控 / 非受控结果面板状态。',
          },
          {
            name: 'onOpenChange',
            type: '(open, { reason }) => void',
            description: '打开或关闭意图回调。',
          },
          {
            name: 'filterOption',
            type: 'false | ((option, query) => boolean)',
            description: '自定义本地过滤；false 表示 options 已由调用方过滤。',
          },
          {
            name: 'displayValue',
            type: '(value, option?) => string',
            description: '异步结果暂时不含 committed option 时解析展示文本。',
          },
          {
            name: 'loading',
            type: 'boolean',
            defaultValue: 'false',
            description: '外部请求状态；保留旧结果但暂时禁止提交。',
          },
          {
            name: 'loadingContent / emptyContent / errorContent',
            type: 'React.ReactNode',
            description: '结果面板状态内容；显式 prop 覆盖 locale 默认文案。',
          },
          {
            name: 'openOnFocus / autoHighlight',
            type: 'boolean',
            defaultValue: 'false / true',
            description: '聚焦即打开，以及打开后自动激活首个 enabled option。',
          },
          {
            name: 'clearable / readOnly / disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '清除、只读与禁用状态。',
          },
          {
            name: 'size / status',
            type: "'sm' | 'md' | 'lg' / 'default' | 'error' | 'success'",
            defaultValue: "'md' / 'default'",
            description: '尺寸与校验视觉状态。',
          },
          {
            name: 'name / form / required',
            type: '原生 input props',
            description: '隐藏 input 只序列化 committed value；可见 input 负责表单约束校验。',
          },
          {
            name: 'classNames',
            type: '{ root?; control?; input?; clear?; toggle?; panel?; listbox?; option?; loading?; empty?; error?; status? }',
            description: 'slot 级类名追加。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Combobox"
        parts={[
          'root',
          'control',
          'input',
          'clear',
          'toggle',
          'panel',
          'listbox',
          'option',
          'loading',
          'empty',
          'error',
          'status',
        ]}
        vars={[
          '--z-combobox-control-height',
          '--z-combobox-control-padding-x',
          '--z-combobox-control-gap',
          '--z-combobox-font-size',
          '--z-combobox-radius',
          '--z-combobox-bg',
          '--z-combobox-fg',
          '--z-combobox-border',
          '--z-combobox-hover-border',
          '--z-combobox-focus-ring',
          '--z-combobox-placeholder-fg',
          '--z-combobox-icon-fg',
          '--z-combobox-clear-hover-bg',
          '--z-combobox-panel-bg',
          '--z-combobox-panel-border',
          '--z-combobox-panel-radius',
          '--z-combobox-panel-shadow',
          '--z-combobox-panel-max-height',
          '--z-combobox-panel-margin-top',
          '--z-combobox-panel-padding',
          '--z-combobox-option-height',
          '--z-combobox-option-padding-x',
          '--z-combobox-option-radius',
          '--z-combobox-option-fg',
          '--z-combobox-option-active-bg',
          '--z-combobox-option-active-fg',
          '--z-combobox-option-disabled-fg',
          '--z-combobox-status-fg',
          '--z-combobox-animation-duration',
        ]}
      />
    </div>
  );
}
