'use client';

import * as React from 'react';
import { Button, Card, Checkbox, Divider, Form, Input } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export interface LoginBlockValues {
  username: string;
  password: string;
  remember: boolean;
}

export interface LoginBlockProps {
  /** 产品名 / 品牌名（logo 旁文案） */
  productName?: string;
  /** logo 插槽：图片或自定义节点，默认渲染字母块 */
  logo?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 提交按钮 loading 态 */
  loading?: boolean;
  /** 顶部错误提示条（如"账号或密码错误"） */
  error?: React.ReactNode;
  rememberDefault?: boolean;
  forgotHref?: string;
  registerHref?: string;
  placeholderUsername?: string;
  placeholderPassword?: string;
  submitText?: string;
  onSubmit?: (values: LoginBlockValues) => void;
  onForgotPassword?: () => void;
  onRegister?: () => void;
  onSocialLogin?: (provider: 'github' | 'wechat' | 'google') => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; card?: string; brand?: string; form?: string };
}

/* --------------------------------- 小图标 --------------------------------- */

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
      {hidden ? <path d="m2 2 20 20" /> : null}
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.7 5.38-5.27 5.66.41.36.78 1.05.78 2.12v3.14c0 .3.2.67.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function WechatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8.7 3.5C4.68 3.5 1.5 6.24 1.5 9.62c0 1.9 1.06 3.6 2.72 4.73l-.68 2.05 2.38-1.2c.83.24 1.72.38 2.66.4a5.6 5.6 0 0 1-.19-1.4c0-3.22 3.1-5.84 6.93-5.84.24 0 .48.01.71.04-.62-2.66-3.44-4.6-6.8-4.6zM6.4 7.9a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9zm4.62 0a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9z" />
      <path d="M22.5 14.2c0-2.83-2.77-5.13-6.19-5.13s-6.19 2.3-6.19 5.13 2.77 5.12 6.19 5.12c.78 0 1.53-.11 2.23-.32l2.13 1.12-.6-1.8c1.56-.97 2.43-2.42 2.43-4.12zm-8.23-1.05a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zm4.12 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39z" />
      <path d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.6A10 10 0 0 0 12 22z" />
      <path d="M6.41 13.89A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.89v-2.6H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.49l3.35-2.6z" />
      <path d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.98 14.7 2 12 2A10 10 0 0 0 3.06 7.51l3.35 2.6C7.2 7.75 9.4 5.98 12 5.98z" />
    </svg>
  );
}

/* ---------------------------------- 区块 ---------------------------------- */

const linkStyle: React.CSSProperties = {
  fontSize: 'var(--z-text-sm)',
  color: 'var(--z-color-link)',
  textDecoration: 'none',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
};

/** 登录页区块：Card + Form + Input + Button + Checkbox 拼装的登录布局 */
export function LoginBlock({
  productName = 'ZUI',
  logo,
  title = '欢迎回来',
  subtitle = '登录你的账号以继续',
  loading = false,
  error,
  rememberDefault = true,
  forgotHref,
  registerHref,
  placeholderUsername = '请输入用户名 / 邮箱',
  placeholderPassword = '请输入密码',
  submitText = '登录',
  onSubmit,
  onForgotPassword,
  onRegister,
  onSocialLogin,
  className,
  style,
  classNames,
}: LoginBlockProps) {
  const [passwordVisible, setPasswordVisible] = React.useState(false);

  const brand = logo ?? (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: 'var(--z-radius-lg)',
        background: 'var(--z-color-primary)',
        color: 'var(--z-color-primary-fg)',
        fontSize: 'var(--z-text-lg)',
        fontWeight: 'var(--z-weight-semibold)',
      }}
    >
      {productName.slice(0, 1).toUpperCase()}
    </span>
  );

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--z-space-6)',
        padding: 'var(--z-space-8) var(--z-space-4)',
        background:
          'radial-gradient(1200px 600px at 50% -10%, var(--z-color-primary-subtle), transparent 60%), var(--z-color-bg-muted)',
        ...style,
      }}
    >
      {/* 品牌位 */}
      <div
        data-part="brand"
        className={classNames?.brand}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--z-space-3)' }}
      >
        {brand}
        <span
          style={{
            fontSize: 'var(--z-text-xl)',
            fontWeight: 'var(--z-weight-semibold)',
            color: 'var(--z-color-fg)',
            letterSpacing: '0.02em',
          }}
        >
          {productName}
        </span>
      </div>

      <Card className={classNames?.card} style={{ width: '100%', maxWidth: 420 }}>
        <div className={classNames?.form} data-part="form" style={{ padding: 'var(--z-space-2) 0' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--z-text-2xl)',
              fontWeight: 'var(--z-weight-semibold)',
              color: 'var(--z-color-fg)',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: 'var(--z-space-2) 0 var(--z-space-6)',
              fontSize: 'var(--z-text-sm)',
              color: 'var(--z-color-fg-muted)',
            }}
          >
            {subtitle}
          </p>

          {error != null ? (
            <div
              role="alert"
              data-part="error"
              style={{
                marginBottom: 'var(--z-space-4)',
                padding: 'var(--z-space-3) var(--z-space-4)',
                borderRadius: 'var(--z-radius-md)',
                background: 'var(--z-color-danger-subtle)',
                color: 'var(--z-color-danger-subtle-fg)',
                fontSize: 'var(--z-text-sm)',
              }}
            >
              {error}
            </div>
          ) : null}

          <Form
            initialValues={{ username: '', password: '', remember: rememberDefault }}
            onFinish={(values) => {
              if (!loading) onSubmit?.({ username: String(values.username ?? ''), password: String(values.password ?? ''), remember: Boolean(values.remember) });
            }}
          >
            <div style={{ marginBottom: 'var(--z-space-4)' }}>
              <Form.Item name="username" label="账号" required>
              <Input
                name="username"
                autoComplete="username"
                size="lg"
                prefix={<UserIcon />}
                placeholder={placeholderUsername}
              />
              </Form.Item>
            </div>

            <div style={{ marginBottom: 'var(--z-space-4)' }}>
              <Form.Item name="password" label="密码" required>
              <Input
                name="password"
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                size="lg"
                prefix={<LockIcon />}
                suffix={
                  <button
                    type="button"
                    aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                    onClick={() => setPasswordVisible((v) => !v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--z-color-fg-muted)',
                    }}
                  >
                    <EyeIcon hidden={passwordVisible} />
                  </button>
                }
                placeholder={placeholderPassword}
              />
              </Form.Item>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--z-space-5)',
              }}
            >
              <Form.Item name="remember"><Checkbox checked={rememberDefault} label="记住我" /></Form.Item>
              {onForgotPassword != null || forgotHref != null ? (
                <a
                  href={forgotHref ?? '#'}
                  style={linkStyle}
                  onClick={
                    onForgotPassword
                      ? (e) => {
                          e.preventDefault();
                          onForgotPassword();
                        }
                      : undefined
                  }
                >
                  忘记密码？
                </a>
              ) : null}
            </div>

            <Button type="submit" size="lg" fullWidth loading={loading}>
              {submitText}
            </Button>
          </Form>

          <Divider style={{ margin: 'var(--z-space-5) 0' }}>或</Divider>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--z-space-3)',
            }}
          >
            {(
              [
                ['github', <GithubIcon key="g" />],
                ['wechat', <WechatIcon key="w" />],
                ['google', <GoogleIcon key="o" />],
              ] as const
            ).map(([provider, icon]) => (
              <Button
                key={provider}
                type="button"
                variant="outline"
                aria-label={`使用 ${provider} 登录`}
                iconStart={icon}
                onClick={() => onSocialLogin?.(provider)}
              />
            ))}
          </div>

          <p
            style={{
              margin: 'var(--z-space-6) 0 0',
              textAlign: 'center',
              fontSize: 'var(--z-text-sm)',
              color: 'var(--z-color-fg-muted)',
            }}
          >
            还没有账号？
            <a
              href={registerHref ?? '#'}
              style={{ ...linkStyle, marginLeft: 'var(--z-space-1)' }}
              onClick={
                onRegister
                  ? (e) => {
                      e.preventDefault();
                      onRegister();
                    }
                  : undefined
              }
            >
              立即注册
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}

export default LoginBlock;
