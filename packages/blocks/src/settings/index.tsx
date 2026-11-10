'use client';

import * as React from 'react';
import { Button, Card, Input, Select, Switch, useControllableState } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

/** 系统设置值（数据 props 化，键值对） */
export interface SettingsValues {
  /** 站点名称 */
  siteName: string;
  /** 站点描述 */
  siteDescription: string;
  /** 邮件通知 */
  emailNotify: boolean;
  /** 短信通知 */
  smsNotify: boolean;
  /** 系统公告 */
  systemNotify: boolean;
  /** 登录二次验证 */
  loginVerify: boolean;
  /** IP 白名单 */
  ipWhitelist: boolean;
  /** 密码策略：basic / strong */
  passwordPolicy: string;
}

export interface SettingsSection {
  key: string;
  title: string;
  description?: string;
}

export interface SettingsBlockProps {
  title?: React.ReactNode;
  /** 设置值（受控） */
  values: SettingsValues;
  /** 单键变更回调 */
  onChange?: (key: keyof SettingsValues, value: string | boolean) => void;
  /** 左侧锚点分组（默认内置三组） */
  sections?: SettingsSection[];
  /** 当前分组（受控） */
  activeSection?: string;
  defaultActiveSection?: string;
  onSectionChange?: (key: string) => void;
  saveText?: string;
  saving?: boolean;
  onSave?: (values: SettingsValues) => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; nav?: string; panel?: string; row?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_SETTINGS_VALUES: SettingsValues = {
  siteName: 'ZUI 管理平台',
  siteDescription: '企业级中后台统一工作台',
  emailNotify: true,
  smsNotify: false,
  systemNotify: true,
  loginVerify: true,
  ipWhitelist: false,
  passwordPolicy: 'strong',
};

export const DEMO_SETTINGS_SECTIONS: SettingsSection[] = [
  { key: 'basic', title: '基本设置', description: '站点名称与描述' },
  { key: 'notify', title: '通知设置', description: '各渠道消息推送偏好' },
  { key: 'security', title: '安全设置', description: '登录与密码策略' },
];

/* --------------------------------- 小组件 --------------------------------- */

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--z-space-4)',
  padding: 'var(--z-space-4) 0',
  borderBottom: '1px solid var(--z-color-border-subtle)',
};

const rowLabelStyle: React.CSSProperties = {
  fontSize: 'var(--z-text-sm)',
  color: 'var(--z-color-fg)',
  fontWeight: 'var(--z-weight-medium)',
};

const rowHintStyle: React.CSSProperties = {
  fontSize: 'var(--z-text-xs)',
  color: 'var(--z-color-fg-muted)',
  marginTop: 2,
};

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div className={className} data-part="row" style={rowStyle}>
      <div>
        <div style={rowLabelStyle}>{label}</div>
        {hint ? <div style={rowHintStyle}>{hint}</div> : null}
      </div>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </div>
  );
}

/* ---------------------------------- 区块 ---------------------------------- */

/** 系统设置区块：左侧锚点式分组导航 + 分区表单 + Switch 偏好开关 */
export function SettingsBlock({
  title = '系统设置',
  values,
  onChange,
  sections = DEMO_SETTINGS_SECTIONS,
  activeSection: activeSectionProp,
  defaultActiveSection,
  onSectionChange,
  saveText = '保存设置',
  saving = false,
  onSave,
  className,
  style,
  classNames,
}: SettingsBlockProps) {
  const idPrefix = React.useId();
  const fieldId = (name: string) => `settings-${idPrefix}-${name}`;
  const [activeSection, setActiveSection] = useControllableState<string>({
    value: activeSectionProp,
    defaultValue: defaultActiveSection ?? sections[0]?.key ?? 'basic',
    onChange: onSectionChange,
  });

  const handleSection = (key: string) => setActiveSection(key);
  const handleField = (key: keyof SettingsValues, value: string | boolean) =>
    onChange?.(key, value);

  const sectionTitleStyle: React.CSSProperties = {
    margin: '0 0 var(--z-space-1)',
    fontSize: 'var(--z-text-lg)',
    fontWeight: 'var(--z-weight-semibold)',
    color: 'var(--z-color-fg)',
  };
  const sectionDescStyle: React.CSSProperties = {
    margin: '0 0 var(--z-space-4)',
    fontSize: 'var(--z-text-sm)',
    color: 'var(--z-color-fg-muted)',
  };
  const fieldLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--z-text-sm)',
    fontWeight: 'var(--z-weight-medium)',
    color: 'var(--z-color-fg)',
    marginBottom: 'var(--z-space-2)',
  };

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 'var(--z-space-5)',
        maxWidth: 920,
        margin: '0 auto',
        padding: 'var(--z-space-6) var(--z-space-4)',
        ...style,
      }}
    >
      {/* 左侧锚点式分组导航 */}
      <nav
        className={classNames?.nav}
        data-part="nav"
        aria-label="设置分组"
        style={{
          display: 'flex',
          flex: '1 1 180px',
          minWidth: 0,
          flexDirection: 'column',
          gap: 'var(--z-space-1)',
        }}
      >
        <h2
          style={{
            margin: '0 0 var(--z-space-3)',
            fontSize: 'var(--z-text-md)',
            fontWeight: 'var(--z-weight-semibold)',
            color: 'var(--z-color-fg)',
          }}
        >
          {title}
        </h2>
        {sections.map((section) => {
          const active = section.key === activeSection;
          return (
            <button
              key={section.key}
              type="button"
              data-part="nav-item"
              data-active={active ? 'true' : 'false'}
              aria-current={active ? 'true' : undefined}
              onClick={() => handleSection(section.key)}
              style={{
                textAlign: 'left',
                padding: 'var(--z-space-2) var(--z-space-3)',
                borderRadius: 'var(--z-radius-md)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--z-text-sm)',
                fontWeight: active ? 'var(--z-weight-semibold)' : 'var(--z-weight-regular)',
                color: active ? 'var(--z-color-primary-subtle-fg)' : 'var(--z-color-fg-muted)',
                background: active ? 'var(--z-color-primary-subtle)' : 'transparent',
              }}
            >
              {section.title}
            </button>
          );
        })}
      </nav>

      {/* 右侧分区表单 */}
      <Card className={classNames?.panel} style={{ flex: '3 1 420px', minWidth: 0 }}>
        {activeSection === 'basic' ? (
          <section data-part="section" data-section="basic" aria-label="基本设置">
            <h3 style={sectionTitleStyle}>基本设置</h3>
            <p style={sectionDescStyle}>站点的公开名称与介绍文案。</p>
            <div style={{ marginBottom: 'var(--z-space-4)' }}>
              <label htmlFor={fieldId('site-name')} style={fieldLabelStyle}>
                站点名称
              </label>
              <Input
                id={fieldId('site-name')}
                name="siteName"
                value={values.siteName}
                onChange={(event) => handleField('siteName', event.target.value)}
                placeholder="请输入站点名称"
              />
            </div>
            <div>
              <label htmlFor={fieldId('site-description')} style={fieldLabelStyle}>
                站点描述
              </label>
              <Input
                id={fieldId('site-description')}
                name="siteDescription"
                value={values.siteDescription}
                onChange={(event) => handleField('siteDescription', event.target.value)}
                placeholder="一句话介绍你的站点"
              />
            </div>
          </section>
        ) : null}

        {activeSection === 'notify' ? (
          <section data-part="section" data-section="notify" aria-label="通知设置">
            <h3 style={sectionTitleStyle}>通知设置</h3>
            <p style={sectionDescStyle}>选择接收系统消息的渠道。</p>
            <SwitchRow
              label="邮件通知"
              hint="审批与公告发送到绑定邮箱"
              checked={values.emailNotify}
              onChange={(checked) => handleField('emailNotify', checked)}
              className={classNames?.row}
            />
            <SwitchRow
              label="短信通知"
              hint="仅重要告警发送短信"
              checked={values.smsNotify}
              onChange={(checked) => handleField('smsNotify', checked)}
              className={classNames?.row}
            />
            <SwitchRow
              label="系统公告"
              hint="在站内消息中心展示"
              checked={values.systemNotify}
              onChange={(checked) => handleField('systemNotify', checked)}
              className={classNames?.row}
            />
          </section>
        ) : null}

        {activeSection === 'security' ? (
          <section data-part="section" data-section="security" aria-label="安全设置">
            <h3 style={sectionTitleStyle}>安全设置</h3>
            <p style={sectionDescStyle}>登录验证与密码强度策略。</p>
            <SwitchRow
              label="登录二次验证"
              hint="新设备登录需要邮箱验证码"
              checked={values.loginVerify}
              onChange={(checked) => handleField('loginVerify', checked)}
              className={classNames?.row}
            />
            <SwitchRow
              label="IP 白名单"
              hint="仅允许白名单内 IP 访问后台"
              checked={values.ipWhitelist}
              onChange={(checked) => handleField('ipWhitelist', checked)}
              className={classNames?.row}
            />
            <div style={{ paddingTop: 'var(--z-space-4)' }}>
              <label htmlFor={fieldId('password-policy')} style={fieldLabelStyle}>
                密码策略
              </label>
              <span style={{ display: 'inline-block', width: 220, maxWidth: '100%' }}>
                <Select
                  id={fieldId('password-policy')}
                  aria-label="密码策略"
                  options={[
                    { value: 'basic', label: '基础（6 位以上）' },
                    { value: 'strong', label: '强（含大小写与数字）' },
                  ]}
                  value={values.passwordPolicy}
                  onChange={(value) => handleField('passwordPolicy', value)}
                />
              </span>
            </div>
          </section>
        ) : null}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: 'var(--z-space-5)',
            borderTop: '1px solid var(--z-color-border-subtle)',
            marginTop: 'var(--z-space-4)',
          }}
        >
          <Button type="button" loading={saving} onClick={() => onSave?.(values)}>
            {saveText}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default SettingsBlock;
