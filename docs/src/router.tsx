import { useEffect, useState } from 'react';

/**
 * 极简 hash 路由（不依赖 react-router）。
 * 返回去掉前导 '#' 的当前路径：'' 或 '#' → '/'，'#/tokens' → '/tokens'。
 */
export function useHashRoute(): string {
  const read = (): string => {
    const raw = window.location.hash.replace(/^#/, '');
    return raw === '' ? '/' : raw;
  };

  const [route, setRoute] = useState<string>(read);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(read());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}

/** 生成导航链接的 href（hash 形式） */
export function hrefFor(path: string): string {
  return `#${path}`;
}
