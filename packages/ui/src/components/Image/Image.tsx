'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx, Portal, useFocusTrap, useScrollLock } from '../../utils';
import './Image.css';

export interface ImageProps extends Omit<React.ComponentPropsWithRef<'img'>, 'onError'> {
  width?: number | string;
  height?: number | string;
  /** 加载失败时的兜底图 */
  fallback?: string;
  /** 点击预览大图，默认 true */
  preview?: boolean;
  alt?: string;
  className?: string;
  classNames?: { root?: string; image?: string; preview?: string };
}

export function Image(props: ImageProps) {
  const { locale } = useZuiConfig();
  const {
    width,
    height,
    fallback,
    preview = true,
    alt = '',
    className,
    classNames,
    src,
    style,
    onClick,
    onKeyDown,
    tabIndex,
    ref,
    ...rest
  } = props;

  const [currentSrc, setCurrentSrc] = React.useState(src);
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  // Portal 首帧不渲染子树（内部 mounted 门控），ref 就绪后再启用焦点陷阱
  const [trapReady, setTrapReady] = React.useState(false);

  React.useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  useScrollLock(open);
  useFocusTrap(previewRef, { active: open && trapReady });

  const setPreviewNode = React.useCallback((node: HTMLDivElement | null) => {
    previewRef.current = node;
    setTrapReady(!!node);
  }, []);

  const handleError = () => {
    if (fallback && currentSrc !== fallback) setCurrentSrc(fallback);
  };

  const onImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && preview && currentSrc) setOpen(true);
  };

  const close = () => setOpen(false);

  return (
    <>
      <div
        ref={rootRef}
        data-part="root"
        className={cx('z-image', classNames?.root, className)}
        data-preview={preview ? 'true' : 'false'}
        style={width !== undefined || height !== undefined ? { width, height } : undefined}
      >
        <img
          {...rest}
          ref={ref}
          data-part="image"
          className={cx('z-image-img', classNames?.image)}
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          style={style}
          tabIndex={tabIndex ?? (preview && currentSrc ? 0 : undefined)}
          aria-haspopup={preview && currentSrc ? 'dialog' : undefined}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented && preview && currentSrc && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          onClick={onImageClick}
          onError={handleError}
        />
      </div>

      {open ? (
        <Portal inheritFrom={rootRef}>
          <div
            data-part="preview"
            className={cx('z-image-preview', classNames?.preview)}
            role="dialog"
            aria-modal="true"
            aria-label={alt || locale.accessibility.imagePreview}
            ref={setPreviewNode}
            tabIndex={-1}
            onClick={close}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
          >
            <img className="z-image-preview-img" src={currentSrc} alt={alt} />
            <button
              type="button"
              className="z-image-preview-close"
              aria-label={locale.accessibility.closePreview}
              onClick={(event) => {
                event.stopPropagation();
                close();
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4.5 4.5l7 7M11.5 4.5l-7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </Portal>
      ) : null}
    </>
  );
}
