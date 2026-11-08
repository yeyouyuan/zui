import { Link } from 'react-router-dom';
import type { SideNavProps } from '@zui/react';

/**
 * 由 docs typecheck 持续验证的 React Router 适配器。
 * Link 会先调用透传的 onClick，再执行自己的客户端导航，因此保持
 * linkProps.onClick → SideNav onNavigate → Router navigation 的顺序。
 */
export const renderReactRouterLink: NonNullable<SideNavProps['renderLink']> = (
  _item,
  { href, ...props }
) => <Link {...props} to={href} />;
