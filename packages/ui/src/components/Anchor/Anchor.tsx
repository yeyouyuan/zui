'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './Anchor.css';

/** 激活判定容差：top ≤ offsetTop + 8px 的节视为已到达阈值 */
const ACTIVATION_TOLERANCE = 8;

export interface AnchorLinkInfo {
  href: string;
  title: React.ReactNode;
}

export interface AnchorLinkProps
  extends Omit<React.ComponentPropsWithRef<'a'>, 'href' | 'title' | 'children'> {
  /** 目标锚点，'#section-id'（必须 # 开头） */
  href: string;
  /** 链接文本 */
  title: React.ReactNode;
  /** 嵌套 Anchor.Link（缩进层级） */
  children?: React.ReactNode;
}

export interface AnchorProps
  extends Omit<React.ComponentPropsWithRef<'nav'>, 'children' | 'className' | 'onClick'> {
  /** 激活判定阈值（px），默认 0 */
  offsetTop?: number;
  /** 滚动容器，默认 window */
  target?: () => HTMLElement | Window;
  /** 链接点击回调（默认滚动行为已 preventDefault，不改写 location.hash） */
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>, link: AnchorLinkInfo) => void;
  className?: string;
  classNames?: { root?: string; link?: string };
  children?: React.ReactNode;
}

/* --------------------------------- Context -------------------------------- */

interface AnchorContextValue {
  activeHref: string | null;
  classNames: AnchorProps['classNames'];
  onLinkClick: (event: React.MouseEvent<HTMLAnchorElement>, link: AnchorLinkInfo) => void;
}

const AnchorContext = React.createContext<AnchorContextValue | null>(null);

function useAnchorContext(component: string): AnchorContextValue {
  const ctx = React.useContext(AnchorContext);
  if (!ctx) {
    throw new Error(`\`${component}\` 必须在 \`Anchor\` 内部使用`);
  }
  return ctx;
}

/* ---------------------------------- Root ---------------------------------- */

function Anchor(props: AnchorProps) {
  const { locale } = useZuiConfig();
  const {
    offsetTop = 0,
    target,
    onClick,
    className,
    classNames,
    children,
    ref: refProp,
    'aria-label': ariaLabel,
    ...rest
  } = props;

  const navRef = React.useRef<HTMLElement | null>(null);
  const rafRef = React.useRef(0);
  const [activeHref, setActiveHref] = React.useState<string | null>(null);

  const setNavRef = React.useCallback(
    (el: HTMLElement | null) => {
      navRef.current = el;
      if (typeof refProp === 'function') {
        refProp(el);
      } else if (refProp) {
        (refProp as { current: unknown }).current = el;
      }
    },
    [refProp]
  );

  /**
   * 滚动侦测：取「top ≤ offsetTop + 8px 的最后一节」为 active；
   * 全部高于阈值时取第一节。节元素按链接在 nav 中的文档顺序遍历。
   */
  const measure = React.useCallback(() => {
    rafRef.current = 0;
    const nav = navRef.current;
    if (!nav) return;
    const links = nav.querySelectorAll<HTMLAnchorElement>('a[href]');
    const seen = new Set<string>();
    const sections: Array<{ href: string; top: number }> = [];
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      if (!href.startsWith('#') || seen.has(href)) continue;
      seen.add(href);
      const section = document.getElementById(href.slice(1));
      if (!section) continue;
      sections.push({ href, top: section.getBoundingClientRect().top });
    }
    if (sections.length === 0) {
      setActiveHref((prev) => (prev === null ? prev : null));
      return;
    }
    const threshold = offsetTop + ACTIVATION_TOLERANCE;
    let next = sections[0].href;
    for (const section of sections) {
      if (section.top <= threshold) next = section.href;
    }
    setActiveHref((prev) => (prev === next ? prev : next));
  }, [offsetTop]);

  // rAF 节流监听 target 滚动 + resize，卸载清理
  React.useEffect(() => {
    const scroller: HTMLElement | Window = target ? target() : window;
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(measure);
    };
    measure();
    const scrollTarget = scroller instanceof window.HTMLElement ? scroller : window;
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      scrollTarget.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [measure, target]);

  const handleLinkClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, link: AnchorLinkInfo) => {
      // 保留原生锚点语义，但不改写 location.hash
      if (link.href.startsWith('#')) event.preventDefault();
      onClick?.(event, link);
      if (!link.href.startsWith('#')) return;
      // 点击即置 active
      setActiveHref(link.href);
      const section = document.getElementById(link.href.slice(1));
      if (!section) return;
      if (offsetTop > 0) {
        // offsetTop 用 scroll-margin-top 抵消（如固定头部高度），滚动目的地计算后还原
        const previousMargin = section.style.scrollMarginTop;
        section.style.scrollMarginTop = `${offsetTop}px`;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.requestAnimationFrame(() => {
          section.style.scrollMarginTop = previousMargin;
        });
      } else {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [offsetTop, onClick]
  );

  const contextValue = React.useMemo<AnchorContextValue>(
    () => ({ activeHref, classNames, onLinkClick: handleLinkClick }),
    [activeHref, classNames, handleLinkClick]
  );

  return (
    <AnchorContext.Provider value={contextValue}>
      <nav
        {...rest}
        ref={setNavRef}
        data-part="root"
        aria-label={ariaLabel ?? locale.accessibility.anchor}
        className={cx('z-anchor', classNames?.root, className)}
      >
        <ul className="z-anchor-list" data-part="list">
          {children}
        </ul>
      </nav>
    </AnchorContext.Provider>
  );
}

/* ---------------------------------- Link ---------------------------------- */

function AnchorLink(props: AnchorLinkProps) {
  const { href, title, children, className, ...rest } = props;
  const { activeHref, classNames, onLinkClick } = useAnchorContext('Anchor.Link');
  const active = activeHref === href;

  return (
    <li className="z-anchor-item" data-part="item">
      <a
        {...rest}
        href={href}
        data-part="link"
        data-active={active ? 'true' : 'false'}
        aria-current={active ? 'true' : undefined}
        className={cx('z-anchor-link', classNames?.link, className)}
        onClick={(event) => onLinkClick(event, { href, title })}
      >
        {title}
      </a>
      {children != null ? (
        <ul className="z-anchor-sublist" data-part="sublist">
          {children}
        </ul>
      ) : null}
    </li>
  );
}

/* -------------------------------- Compound -------------------------------- */

const AnchorRoot = Object.assign(Anchor, {
  Link: AnchorLink,
});

export { AnchorRoot as Anchor, AnchorLink };
