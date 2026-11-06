'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './Result.css';

export type ResultStatus = 'success' | 'error' | 'info' | 'warning' | '404' | '403' | '500';

export interface ResultProps {
  /** 结果状态，默认 'info' */
  status?: ResultStatus;
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
  /** 操作按钮区 */
  extra?: React.ReactNode;
  className?: string;
  classNames?: {
    root?: string;
    icon?: string;
    title?: string;
    subtitle?: string;
    extra?: string;
  };
}

function ResultIcon({ status }: { status: ResultStatus }) {
  if (status === 'success') {
    return (
      <svg viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <circle cx="36" cy="36" r="32" stroke="currentColor" strokeWidth="4" />
        <path
          d="M22 37.5 32 47.5 50 26.5"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <circle cx="36" cy="36" r="32" stroke="currentColor" strokeWidth="4" />
        <path
          d="M26 26l20 20M46 26 26 46"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (status === 'warning') {
    return (
      <svg viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <path
          d="M36 10 64 60H8L36 10Z"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M36 28v16" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <circle cx="36" cy="51" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (status === 'info') {
    return (
      <svg viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <circle cx="36" cy="36" r="32" stroke="currentColor" strokeWidth="4" />
        <circle cx="36" cy="24" r="4" fill="currentColor" />
        <path d="M36 34v16" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }
  // 403 / 404 / 500：数字码
  return (
    <svg viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <circle cx="36" cy="36" r="32" stroke="currentColor" strokeWidth="4" />
      <text
        x="36"
        y="44"
        textAnchor="middle"
        fill="currentColor"
        fontSize="22"
        fontWeight="600"
        fontFamily="var(--z-font-sans)"
      >
        {status}
      </text>
    </svg>
  );
}



export function Result(props: ResultProps) {
  const { locale } = useZuiConfig();
  const {
    status = 'info',
    title,
    subTitle,
    extra,
    className,
    classNames,
    ...rest
  } = props;

  const resolvedTitle = title ?? locale.result[status] ?? locale.result.info;

  return (
    <div
      {...rest}
      data-part="root"
      className={cx('z-result', classNames?.root, className)}
      data-status={status}
    >
      <div data-part="icon" className={cx('z-result-icon', classNames?.icon)}>
        <ResultIcon status={status} />
      </div>
      <div data-part="title" className={cx('z-result-title', classNames?.title)}>
        {resolvedTitle}
      </div>
      {subTitle !== undefined && subTitle !== null ? (
        <div data-part="subtitle" className={cx('z-result-subtitle', classNames?.subtitle)}>
          {subTitle}
        </div>
      ) : null}
      {extra !== undefined && extra !== null ? (
        <div data-part="extra" className={cx('z-result-extra', classNames?.extra)}>
          {extra}
        </div>
      ) : null}
    </div>
  );
}
