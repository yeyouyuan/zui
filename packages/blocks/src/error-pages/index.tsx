'use client';

import * as React from 'react';
import { Button, Result, Segmented, useControllableState } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export type ErrorPageStatus = '403' | '404' | '500';

export interface ErrorPageCopy {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
}

export interface ErrorPagesBlockProps {
  /** 错误页状态（受控）；不传走非受控 */
  status?: ErrorPageStatus;
  defaultStatus?: ErrorPageStatus;
  onStatusChange?: (status: ErrorPageStatus) => void;
  /** 是否展示内置状态切换器（演示用），默认 false */
  showSwitcher?: boolean;
  /** 三态自定义文案（key 为状态码） */
  copy?: Partial<Record<ErrorPageStatus, ErrorPageCopy>>;
  /** 返回上一页回调（点击「返回上一页」按钮） */
  onBack?: () => void;
  /** 回到首页回调（点击「回到首页」按钮） */
  onHome?: () => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; switcher?: string; extra?: string };
}

/* -------------------------------- 演示文案 -------------------------------- */

const DEFAULT_COPY: Record<ErrorPageStatus, ErrorPageCopy> = {
  '403': {
    title: '403',
    subTitle: '抱歉，你没有权限访问该页面',
  },
  '404': {
    title: '404',
    subTitle: '抱歉，你访问的页面不存在或已被移除',
  },
  '500': {
    title: '500',
    subTitle: '抱歉，服务器出了点问题，请稍后再试',
  },
};

const STATUS_OPTIONS: { value: ErrorPageStatus; label: string }[] = [
  { value: '403', label: '403' },
  { value: '404', label: '404' },
  { value: '500', label: '500' },
];

/* ---------------------------------- 区块 ---------------------------------- */

/** 错误页集区块：Result 403/404/500 三态（同一区块内 props 切换）+ 返回操作 */
export function ErrorPagesBlock({
  status,
  defaultStatus = '404',
  onStatusChange,
  showSwitcher = false,
  copy,
  onBack,
  onHome,
  className,
  style,
  classNames,
}: ErrorPagesBlockProps) {
  const [currentStatus, setCurrentStatus] = useControllableState<ErrorPageStatus>({
    value: status,
    defaultValue: defaultStatus,
    onChange: onStatusChange,
  });

  const merged = { ...DEFAULT_COPY, ...copy };
  const active = merged[currentStatus] ?? {};

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        padding: 'clamp(var(--z-space-4), 4vw, var(--z-space-9))',
        background: 'var(--z-color-bg-muted)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--z-space-5)',
        ...style,
      }}
    >
      {/* 内置状态切换器（演示用） */}
      {showSwitcher ? (
        <div className={classNames?.switcher}>
          <Segmented
            options={STATUS_OPTIONS}
            value={currentStatus}
            onChange={(value) => setCurrentStatus(value as ErrorPageStatus)}
            aria-label="错误页状态切换"
          />
        </div>
      ) : null}

      {/* Result 三态 */}
      <Result status={currentStatus} title={active.title} subTitle={active.subTitle} />

      {/* 返回操作 */}
      <div
        data-part="extra"
        className={classNames?.extra}
        style={{ display: 'flex', gap: 'var(--z-space-3)', flexWrap: 'wrap', justifyContent: 'center' }}
      >
        <Button variant="outline" onClick={() => onBack?.()}>
          返回上一页
        </Button>
        <Button onClick={() => onHome?.()}>回到首页</Button>
      </div>
    </div>
  );
}

export default ErrorPagesBlock;
