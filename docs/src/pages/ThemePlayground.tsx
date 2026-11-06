import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Select,
  Switch,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTrigger,
} from '@zui/react';

import CodeBlock from '../components/CodeBlock';
import { usePageTitle } from '../components/usePageTitle';
import '../styles/theme-playground.css';

const DEFAULT_HUE = 255;
const DEFAULT_RADIUS = 10;
const DEFAULT_FONT_BASE = 16;

interface ThemePreset {
  key: string;
  name: string;
  hue: number;
  radius: number;
  fontBase: number;
}

const PRESETS: ThemePreset[] = [
  { key: 'blue', name: '默认蓝', hue: 255, radius: 10, fontBase: 16 },
  { key: 'indigo', name: '靛青', hue: 230, radius: 8, fontBase: 16 },
  { key: 'purple', name: '深紫', hue: 300, radius: 6, fontBase: 15 },
  { key: 'violet', name: '藤紫', hue: 275, radius: 12, fontBase: 16 },
  { key: 'green', name: '森绿', hue: 150, radius: 14, fontBase: 16 },
  { key: 'teal', name: '青绿', hue: 175, radius: 10, fontBase: 16 },
  { key: 'orange', name: '暖橙', hue: 35, radius: 12, fontBase: 16 },
  { key: 'red', name: '赤红', hue: 8, radius: 8, fontBase: 16 },
  { key: 'pink', name: '樱粉', hue: 335, radius: 14, fontBase: 17 },
  { key: 'slate', name: '石板灰', hue: 210, radius: 4, fontBase: 15 },
];

function primaryVars(hue: number, dark = false): Record<string, string> {
  return {
    '--z-color-primary': `hsl(${hue} 62% ${dark ? 68 : 46}%)`,
    '--z-color-primary-hover': `hsl(${hue} 62% ${dark ? 74 : 40}%)`,
    '--z-color-primary-active': `hsl(${hue} 62% ${dark ? 80 : 34}%)`,
    '--z-color-primary-fg': `hsl(${hue} 62% ${dark ? 10 : 97}%)`,
    '--z-color-primary-subtle': `hsl(${hue} 62% ${dark ? 18 : 95}%)`,
    '--z-color-primary-subtle-fg': `hsl(${hue} 62% ${dark ? 82 : 36}%)`,
    '--z-color-border-focus': `hsl(${hue} 62% ${dark ? 68 : 46}%)`,
    '--z-color-link': `hsl(${hue} 62% ${dark ? 68 : 46}%)`,
    '--z-color-link-hover': `hsl(${hue} 62% ${dark ? 74 : 40}%)`,
    '--z-color-focus-ring': `hsl(${hue} 62% ${dark ? 68 : 46}%)`,
  };
}

function fontVars(base: number): Record<string, string> {
  return {
    '--z-text-xs': `${(base * 0.75).toFixed(1)}px`,
    '--z-text-sm': `${(base * 0.875).toFixed(1)}px`,
    '--z-text-md': `${base}px`,
    '--z-text-lg': `${(base * 1.125).toFixed(1)}px`,
    '--z-text-xl': `${(base * 1.25).toFixed(1)}px`,
    '--z-text-2xl': `${(base * 1.5).toFixed(1)}px`,
  };
}

function radiusVars(radius: number): Record<string, string> {
  return { '--z-radius': `${radius}px`, '--z-radius-sm': `${radius * 0.6}px`, '--z-radius-md': `${radius}px`, '--z-radius-lg': `${radius * 1.4}px`, '--z-radius-xl': `${radius * 2}px` };
}

function allVars(hue: number, radius: number, fontBase: number, dark = false): Record<string, string> {
  return { ...primaryVars(hue, dark), ...radiusVars(radius), ...fontVars(fontBase) };
}

function Preview({ vars, dark = false, label }: { vars?: Record<string, string>; dark?: boolean; label: string }) {
  return (
    <section
      className="doc-theme-preview"
      data-theme={dark ? 'dark' : 'light'}
      style={vars as React.CSSProperties}
      aria-label={label}
    >
      <div className="doc-theme-preview-heading">{label}</div>
      <div className="doc-pg-preview-row">
        <Button variant="primary">主要按钮</Button>
        <Button variant="secondary">次要按钮</Button>
        <Button variant="outline">描边按钮</Button>
        <Button variant="ghost">幽灵按钮</Button>
        <Button variant="danger">危险按钮</Button>
      </div>
      <div className="doc-pg-preview-row">
        <Input placeholder="请输入内容" prefix="搜索" clearable style={{ width: 240, maxWidth: '100%' }} />
        <div style={{ width: 160, maxWidth: '100%' }}>
          <Select options={[{ value: 'react', label: 'React' }, { value: 'vue', label: 'Vue' }, { value: 'svelte', label: 'Svelte' }]} placeholder="选择框架" />
        </div>
      </div>
      <div className="doc-pg-preview-row">
        <Checkbox label="复选框" defaultChecked />
        <Switch label="开关" defaultChecked />
      </div>
      <Tabs defaultValue="one">
        <TabsList><TabsTrigger value="one">标签一</TabsTrigger><TabsTrigger value="two">标签二</TabsTrigger><TabsTrigger value="three">标签三</TabsTrigger></TabsList>
        <TabsPanel value="one">令牌驱动的内容面板，颜色、圆角和字阶均来自当前主题。</TabsPanel>
        <TabsPanel value="two">切换滑杆，观察当前预览的排版与强调色。</TabsPanel>
        <TabsPanel value="three">原始预览不写入覆盖变量，便于与当前主题对照。</TabsPanel>
      </Tabs>
    </section>
  );
}

function validateNumber(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} 必须是 ${min}–${max} 范围内的数字`);
  if (value < min || value > max) throw new Error(`${name} 必须介于 ${min} 和 ${max} 之间`);
  return value;
}

export default function ThemePlayground(): React.ReactNode {
  usePageTitle('主题调参');
  const [hue, setHue] = useState(DEFAULT_HUE);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [fontBase, setFontBase] = useState(DEFAULT_FONT_BASE);
  const [dark, setDark] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');

  const vars = useMemo(() => allVars(hue, radius, fontBase, dark), [hue, radius, fontBase, dark]);
  const activePreset = PRESETS.find((preset) => preset.hue === hue && preset.radius === radius && preset.fontBase === fontBase);

  const onHueChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { setHue(Number(event.target.value)); setImportError(''); }, []);
  const onRadiusChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { setRadius(Number(event.target.value)); setImportError(''); }, []);
  const onFontChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { setFontBase(Number(event.target.value)); setImportError(''); }, []);

  const applyPreset = (preset: ThemePreset) => {
    setHue(preset.hue); setRadius(preset.radius); setFontBase(preset.fontBase);
    setImportError(''); setImportMessage(`已应用「${preset.name}」`);
  };

  const handleReset = () => {
    setHue(DEFAULT_HUE); setRadius(DEFAULT_RADIUS); setFontBase(DEFAULT_FONT_BASE); setDark(false);
    setImportError(''); setImportMessage('已恢复默认主题');
  };

  const handleImport = () => {
    setImportError(''); setImportMessage('');
    try {
      if (!importText.trim()) throw new Error('请先粘贴主题 JSON');
      const parsed: unknown = JSON.parse(importText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('主题 JSON 必须是对象');
      const data = parsed as Record<string, unknown>;
      const nextHue = validateNumber(data.hue, 'hue', 0, 360);
      const nextRadius = validateNumber(data.radius, 'radius', 0, 24);
      const nextFont = validateNumber(data.fontBase, 'fontBase', 12, 20);
      if (data.dark !== undefined && typeof data.dark !== 'boolean') throw new Error('dark 必须是布尔值');
      setHue(nextHue); setRadius(nextRadius); setFontBase(nextFont);
      if (typeof data.dark === 'boolean') setDark(data.dark);
      setImportMessage('主题 JSON 已导入并应用');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '主题 JSON 无法解析');
    }
  };

  const cssOutput = `:root {
${Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`).join('\n')}
}`;
  const jsonOutput = JSON.stringify({ name: activePreset?.name ?? '自定义主题', hue, radius, fontBase, dark, vars }, null, 2);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">主题调参</h1>
      <p className="doc-lead">在线调整主色、圆角与字阶，当前主题只作用于下方预览区域。左侧原始主题与右侧当前主题并排展示，方便核对视觉偏移。</p>
      <div className="doc-pg-layout">
        <aside className="doc-pg-controls">
          <div className="doc-pg-field">
            <span className="doc-pg-label">预设主题</span>
            <div className="doc-pg-presets" role="group" aria-label="预设主题">
              {PRESETS.map((preset) => {
                const active = activePreset?.key === preset.key;
                return <button key={preset.key} type="button" className={active ? 'doc-pg-preset-btn doc-pg-preset-btn--active' : 'doc-pg-preset-btn'} aria-pressed={active} onClick={() => applyPreset(preset)}>
                  <span className="doc-pg-preset-dot" style={{ background: `hsl(${preset.hue} 62% 46%)` }} />{preset.name}<span className="doc-pg-preset-meta">hue {preset.hue} · r{preset.radius}</span>
                </button>;
              })}
            </div>
          </div>
          <div className="doc-pg-field"><label className="doc-pg-label" htmlFor="pg-hue">主色 Hue <span className="doc-pg-value">{hue}°</span></label><input id="pg-hue" className="doc-pg-slider" type="range" min={0} max={360} value={hue} onChange={onHueChange} /></div>
          <div className="doc-pg-field"><label className="doc-pg-label" htmlFor="pg-radius">圆角半径 <span className="doc-pg-value">{radius}px</span></label><input id="pg-radius" className="doc-pg-slider" type="range" min={0} max={24} value={radius} onChange={onRadiusChange} /></div>
          <div className="doc-pg-field"><label className="doc-pg-label" htmlFor="pg-font">字号基准 <span className="doc-pg-value">{fontBase}px</span></label><input id="pg-font" className="doc-pg-slider" type="range" min={12} max={20} value={fontBase} onChange={onFontChange} /></div>
          <div className="doc-pg-switch-row"><Switch checked={dark} onChange={setDark} label="当前预览暗色" /><span className="doc-pg-value">仅作用于当前主题预览</span></div>
          <div className="doc-pg-actions"><Button variant="secondary" onClick={handleReset}>重置</Button></div>
          <div className="doc-theme-import">
            <label className="doc-pg-label" htmlFor="theme-json-import">导入主题 JSON</label>
            <textarea id="theme-json-import" value={importText} onChange={(event) => setImportText(event.target.value)} rows={6} placeholder={'{"hue": 255, "radius": 10, "fontBase": 16}'} />
            <Button variant="outline" onClick={handleImport}>验证并应用</Button>
            {importError ? <div className="doc-theme-import-error" role="alert">{importError}</div> : null}
            {importMessage ? <div className="doc-theme-import-message" role="status">{importMessage}</div> : null}
          </div>
        </aside>
        <div className="doc-theme-comparison"><Preview label="原始主题" /><Preview label="当前主题" vars={vars} dark={dark} /></div>
      </div>
      <h2 className="doc-h2">导出主题</h2>
      <p className="doc-p">CSS 可放入 <code className="doc-code-inline">:root</code>，JSON 可供构建工具或设计令牌流水线消费。</p>
      <Tabs defaultValue="css">
        <TabsList><TabsTrigger value="css">CSS</TabsTrigger><TabsTrigger value="json">JSON</TabsTrigger></TabsList>
        <TabsPanel value="css"><CodeBlock code={cssOutput} language="css" /></TabsPanel>
        <TabsPanel value="json"><CodeBlock code={jsonOutput} language="json" /></TabsPanel>
      </Tabs>
    </div>
  );
}
