'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { FloatingPanel, cx, useControllableState, useOnClickOutside } from '../../utils';
import './ColorPicker.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type ColorPickerSize = 'sm' | 'md' | 'lg';

export interface ColorPickerProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'value' | 'defaultValue' | 'onChange'
> {
  /** 受控值（hex：'#rgb' / '#rrggbb' / 省略 '#' 均可，统一归一化为 '#rrggbb' 小写） */
  value?: string;
  /** 非受控初始值，默认 '#ff0000' */
  defaultValue?: string;
  /** 值变更回调（归一化 '#rrggbb' 小写） */
  onChange?: (hex: string) => void;
  /** 禁用 */
  disabled?: boolean;
  /** 触发器尺寸，默认 'md' */
  size?: ColorPickerSize;
  className?: string;
  classNames?: {
    root?: string;
    swatch?: string;
    panel?: string;
    hue?: string;
  };
}

/* ---------------------------------- 常量 ---------------------------------- */

const DEFAULT_HEX = '#ff0000';
/** 面板内 ←→/↑↓ 调 SV 的步进（百分比） */
const SV_STEP = 2;
/** 色相键盘步进（度） */
const HUE_STEP = 2;

/*
 * 色空间可视化基色（纯色相谱、白/黑叠加层）：取色器数学模型的一部分，
 * 与主题无关，不走语义令牌，以行内样式注入（CSS 只消费语义令牌）。
 */
const HUE_RAMP =
  'linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))';
const SV_WHITE_OVERLAY = 'linear-gradient(to right, #fff, rgba(255, 255, 255, 0))';
const SV_BLACK_OVERLAY = 'linear-gradient(to top, #000, rgba(0, 0, 0, 0))';

/* ---------------------------------- 工具 ---------------------------------- */

interface Hsv {
  /** 色相 0..360 */
  h: number;
  /** 饱和度 0..100 */
  s: number;
  /** 明度 0..100 */
  v: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampHue(h: number): number {
  return clamp(h, 0, 360);
}

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** 归一化 hex（'#rgb' → '#rrggbb'，小写）；非法返回 null */
function normalizeHex(input: string): string | null {
  const match = HEX_PATTERN.exec(input.trim());
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  return `#${hex}`;
}

function hsvToHex(h: number, s: number, v: number): string {
  const sat = s / 100;
  const val = v / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = val - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (channel: number) =>
    clamp(Math.round((channel + m) * 255), 0, 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): Hsv {
  const normalized = normalizeHex(hex);
  if (!normalized) return { h: 0, s: 0, v: 100 };
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : (delta / max) * 100;
  return { h: Math.round(h), s: Math.round(s), v: Math.round(max * 100) };
}

/* --------------------------------- 组件实现 -------------------------------- */

export function ColorPicker({
  value: valueProp,
  defaultValue = DEFAULT_HEX,
  onChange,
  disabled = false,
  size = 'md',
  className,
  classNames,
  style,
  ref,
  onKeyDown,
  ...rest
}: ColorPickerProps) {
  const { locale } = useZuiConfig();
  const [value, setValue] = useControllableState<string>({
    value: valueProp,
    defaultValue,
    onChange,
  });

  const normalized = normalizeHex(value) ?? DEFAULT_HEX;
  const [hsv, setHsv] = React.useState<Hsv>(() => hexToHsv(normalized));
  // 受控值被外部改写时以 value 为准重新推导 HSV；未变时保留 HSV（灰阶下色相不丢）
  const activeHsv = hsvToHex(hsv.h, hsv.s, hsv.v) !== normalized ? hexToHsv(normalized) : hsv;

  const [open, setOpen] = React.useState(false);
  const [dragging, setDragging] = React.useState<'sv' | 'hue' | null>(null);
  const [hexDraft, setHexDraft] = React.useState(normalized);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const svRef = React.useRef<HTMLDivElement | null>(null);
  const hueRef = React.useRef<HTMLDivElement | null>(null);
  const hsvRef = React.useRef<Hsv>(activeHsv);
  const baseId = React.useId();
  const panelId = `${baseId}-panel`;

  React.useEffect(() => {
    hsvRef.current = activeHsv;
  });

  // hex 文本与值同步：草稿可归一化为当前值（键入中）则不覆盖
  React.useEffect(() => {
    setHexDraft((prev) => (normalizeHex(prev) === normalized ? prev : normalized));
  }, [normalized]);

  React.useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  /** 以 HSV 提交新值（partial 覆盖，越界 clamp） */
  const commitHsv = React.useCallback(
    (partial: Partial<Hsv>) => {
      const base = hsvRef.current;
      const next: Hsv = {
        h: clampHue(partial.h ?? base.h),
        s: clamp(partial.s ?? base.s, 0, 100),
        v: clamp(partial.v ?? base.v, 0, 100),
      };
      hsvRef.current = next;
      setHsv(next);
      const hex = hsvToHex(next.h, next.s, next.v);
      if (hex !== hsvToHex(base.h, base.s, base.v)) setValue(hex);
    },
    [setValue]
  );

  const commitHex = (hex: string) => {
    if (hex === normalized) return;
    const next = hexToHsv(hex);
    hsvRef.current = next;
    setHsv(next);
    setValue(hex);
  };

  const pickSv = React.useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = clamp(Math.round(((clientX - rect.left) / (rect.width || 1)) * 100), 0, 100);
      const v = clamp(Math.round((1 - (clientY - rect.top) / (rect.height || 1)) * 100), 0, 100);
      commitHsv({ s, v });
    },
    [commitHsv]
  );

  const pickHue = React.useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = clamp(Math.round(((clientX - rect.left) / (rect.width || 1)) * 360), 0, 360);
      commitHsv({ h });
    },
    [commitHsv]
  );

  /* ------------------------------ 开关与焦点 ----------------------------- */

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setDragging(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  // 源节点与 Portal 面板之外点击关闭
  const outsideRefs = React.useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(outsideRefs, () => close(false), open);

  // Esc 关闭并把焦点归还触发器
  React.useEffect(() => {
    if (!open) return;
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => document.removeEventListener('keydown', onDocumentKeyDown);
  }, [open]);

  /* -------------------------------- 交互 -------------------------------- */

  const handleTriggerClick = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    const onHue = hueRef.current === target;
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        commitHsv(onHue ? { h: activeHsv.h - HUE_STEP } : { s: activeHsv.s - SV_STEP });
        break;
      case 'ArrowRight':
        event.preventDefault();
        commitHsv(onHue ? { h: activeHsv.h + HUE_STEP } : { s: activeHsv.s + SV_STEP });
        break;
      case 'ArrowUp':
        event.preventDefault();
        commitHsv(onHue ? { h: activeHsv.h + HUE_STEP } : { v: activeHsv.v + SV_STEP });
        break;
      case 'ArrowDown':
        event.preventDefault();
        commitHsv(onHue ? { h: activeHsv.h - HUE_STEP } : { v: activeHsv.v - SV_STEP });
        break;
      case 'Home':
        event.preventDefault();
        commitHsv({ h: 0 });
        break;
      case 'End':
        event.preventDefault();
        commitHsv({ h: 360 });
        break;
      default:
        break;
    }
  };

  const handleSvMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    svRef.current?.focus();
    pickSv(event.clientX, event.clientY);
    setDragging('sv');
  };

  const handleHueMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    hueRef.current?.focus();
    pickHue(event.clientX);
    setDragging('hue');
  };

  // 拖拽取色：按下后跟随指针，松开结束
  React.useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (event: MouseEvent) => {
      if (dragging === 'sv') pickSv(event.clientX, event.clientY);
      else pickHue(event.clientX);
    };
    const onMouseUp = () => setDragging(null);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, pickSv, pickHue]);

  const handleHexChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setHexDraft(raw);
    const parsed = normalizeHex(raw);
    if (parsed) commitHex(parsed);
  };

  const setRootRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = node;
    },
    [ref]
  );

  const handleRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !open) return;
    // 面板内 ←→/↑↓ 调 SV、Home/End 调 hue（hex 输入框等文本控件除外）
    if (!panelRef.current?.contains(event.target as Node)) return;
    handlePanelKeyDown(event);
  };

  const handleFloatingPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };

  return (
    <div
      {...rest}
      ref={setRootRef}
      data-part="root"
      data-size={size}
      data-open={open ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      className={cx('z-color-picker', className, classNames?.root)}
      style={style}
      onKeyDown={handleRootKeyDown}
    >
      <button
        type="button"
        ref={triggerRef}
        data-part="swatch"
        className={cx('z-color-picker-swatch', classNames?.swatch)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={rest['aria-label'] ?? locale.accessibility.colorPicker}
        disabled={disabled}
        onClick={handleTriggerClick}
      >
        <span
          data-part="swatch-color"
          className="z-color-picker-swatch-color"
          style={{ background: normalized }}
        />
        <span data-part="swatch-hex" className="z-color-picker-swatch-hex">
          {normalized}
        </span>
      </button>
      {open ? (
        <FloatingPanel
          open={open}
          anchorRef={rootRef}
          focusOnOpen
          initialFocusSelector="[data-part='sv']"
        >
          <div
            ref={panelRef}
            data-part="panel"
            id={panelId}
            role="dialog"
            aria-label={locale.accessibility.colorPanel}
            tabIndex={-1}
            className={cx('z-color-picker-panel', classNames?.panel)}
            onKeyDown={handleFloatingPanelKeyDown}
          >
            <div
              ref={svRef}
              data-part="sv"
              className="z-color-picker-sv"
              role="slider"
              tabIndex={0}
              aria-label={locale.accessibility.saturationBrightness}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={activeHsv.s}
              aria-valuetext={locale.accessibility.colorValue
                .replace('{s}', String(activeHsv.s))
                .replace('{v}', String(activeHsv.v))}
              style={{ background: `hsl(${activeHsv.h} 100% 50%)` }}
              onMouseDown={handleSvMouseDown}
            >
              <span
                data-part="sv-white"
                className="z-color-picker-sv-overlay"
                style={{ background: SV_WHITE_OVERLAY }}
              />
              <span
                data-part="sv-black"
                className="z-color-picker-sv-overlay"
                style={{ background: SV_BLACK_OVERLAY }}
              />
              <span
                data-part="sv-pointer"
                className="z-color-picker-pointer"
                style={{
                  left: `${activeHsv.s}%`,
                  top: `${100 - activeHsv.v}%`,
                  background: normalized,
                }}
              />
            </div>
            <div
              ref={hueRef}
              data-part="hue"
              className={cx('z-color-picker-hue', classNames?.hue)}
              role="slider"
              tabIndex={0}
              aria-label={locale.accessibility.hue}
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={activeHsv.h}
              aria-valuetext={`${activeHsv.h}°`}
              style={{ background: HUE_RAMP }}
              onMouseDown={handleHueMouseDown}
            >
              <span
                data-part="hue-pointer"
                className="z-color-picker-pointer"
                style={{ left: `${(activeHsv.h / 360) * 100}%` }}
              />
            </div>
            <div className="z-color-picker-hex-row">
              <input
                data-part="hex"
                className="z-color-picker-hex-input"
                value={hexDraft}
                aria-label={locale.accessibility.hex}
                spellCheck={false}
                autoComplete="off"
                onChange={handleHexChange}
                onBlur={() => setHexDraft(normalized)}
              />
            </div>
          </div>
        </FloatingPanel>
      ) : null}
    </div>
  );
}
