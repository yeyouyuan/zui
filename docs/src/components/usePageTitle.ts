import { useEffect } from 'react';

/** 统一更新页面标题（document.title） */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ZUI 文档`;
  }, [title]);
}
