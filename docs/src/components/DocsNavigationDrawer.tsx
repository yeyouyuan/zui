import type { ReactNode } from 'react';
import { Drawer } from '@zui/react';

interface DocsNavigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/** 仅在移动断点加载，避免文档首屏同步引入整个组件包 barrel。 */
export default function DocsNavigationDrawer({
  open,
  onOpenChange,
  children,
}: DocsNavigationDrawerProps): ReactNode {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Trigger
        className="doc-menu-btn"
        aria-expanded={open}
        aria-controls="doc-nav-drawer"
        aria-label={open ? '关闭文档菜单' : '打开文档菜单'}
      >
        菜单
      </Drawer.Trigger>
      <Drawer.Content
        id="doc-nav-drawer"
        className="doc-nav-drawer"
        placement="left"
        size="min(20rem, 100vw)"
        classNames={{ overlay: 'doc-nav-drawer-overlay' }}
      >
        <Drawer.Header>
          <Drawer.Title>文档菜单</Drawer.Title>
          <Drawer.Close aria-label="关闭文档菜单" />
        </Drawer.Header>
        <Drawer.Body className="doc-nav-drawer-body">{children}</Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
}
