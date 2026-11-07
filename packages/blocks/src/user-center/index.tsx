'use client';

import * as React from 'react';
import { Avatar, Card, Descriptions, Switch, Tabs, Upload, useControllableState } from '@zui/react';
import type { UploadChangeInfo, UploadFile } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

/** 个人中心用户信息（数据 props 化） */
export interface UserCenterUser {
  key?: string;
  name: string;
  /** 登录账号 */
  account: string;
  email?: string;
  phone?: string;
  /** 角色 / 职位 */
  role?: string;
  department?: string;
  location?: string;
  /** 入职 / 注册日期文案 */
  joinDate?: string;
  bio?: string;
  /** 头像图地址（空则按名字回退首字） */
  avatarSrc?: string;
}

/** 偏好开关项 */
export interface UserPreferenceItem {
  key: string;
  label: string;
  description?: string;
  checked: boolean;
}

export interface UserCenterBlockProps {
  user: UserCenterUser;
  /** 头像上传受控文件列表 */
  avatarFileList?: UploadFile[];
  defaultAvatarFiles?: UploadFile[];
  onAvatarFilesChange?: (info: UploadChangeInfo) => void;
  /** 当前 Tab（受控），取值 profile / security / preferences */
  activeTab?: string;
  defaultActiveTab?: string;
  onTabChange?: (tab: string) => void;
  /** 偏好开关组（数据 props 化） */
  preferences?: UserPreferenceItem[];
  onPreferenceChange?: (key: string, checked: boolean) => void;
  /** 安全 Tab：登录二次验证开关 */
  twoFactorEnabled?: boolean;
  onTwoFactorChange?: (checked: boolean) => void;
  onEditProfile?: () => void;
  onChangePassword?: () => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: {
    root?: string;
    header?: string;
    tabs?: string;
    panel?: string;
    preferences?: string;
  };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_USER: UserCenterUser = {
  key: 'u-1',
  name: '林小满',
  account: 'xiaoman.lin',
  email: 'xiaoman.lin@example.com',
  phone: '+86 138 0000 0000',
  role: '前端工程师',
  department: '平台研发部 / 体验技术组',
  location: '杭州',
  joinDate: '2023-06-12',
  bio: '负责 ZUI 组件库与设计系统工程化建设。',
  avatarSrc: 'https://example.com/avatars/xiaoman.png',
};

export const DEMO_PREFERENCES: UserPreferenceItem[] = [
  {
    key: 'emailNotify',
    label: '邮件通知',
    description: '系统公告与审批提醒发送到邮箱',
    checked: true,
  },
  { key: 'weeklyReport', label: '每周摘要', description: '每周一汇总上周工作动态', checked: false },
  { key: 'compactMode', label: '紧凑模式', description: '列表与表格使用更小的行高', checked: true },
];

/* --------------------------------- 小图标 --------------------------------- */

function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

/* ---------------------------------- 区块 ---------------------------------- */

const actionButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--z-space-1)',
  padding: '6px 12px',
  borderRadius: 'var(--z-radius-md)',
  border: '1px solid var(--z-color-border)',
  background: 'var(--z-color-bg)',
  color: 'var(--z-color-fg)',
  fontSize: 'var(--z-text-sm)',
  cursor: 'pointer',
};

/** 个人中心区块：Avatar + Descriptions + Tabs（资料/安全/偏好）+ Upload 头像上传 */
export function UserCenterBlock({
  user,
  avatarFileList,
  defaultAvatarFiles,
  onAvatarFilesChange,
  activeTab: activeTabProp,
  defaultActiveTab = 'profile',
  onTabChange,
  preferences = [],
  onPreferenceChange,
  twoFactorEnabled = false,
  onTwoFactorChange,
  onEditProfile,
  onChangePassword,
  className,
  style,
  classNames,
}: UserCenterBlockProps) {
  // useControllableState 在受控/非受控下都会回调 onChange，无需显式转发
  const [activeTab, setActiveTab] = useControllableState<string>({
    value: activeTabProp,
    defaultValue: defaultActiveTab,
    onChange: onTabChange,
  });

  const handleTabChange = (next: string) => {
    setActiveTab(next);
  };

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--z-space-4)',
        maxWidth: 880,
        margin: '0 auto',
        padding: 'var(--z-space-6) var(--z-space-4)',
        ...style,
      }}
    >
      {/* 头部：头像 + 基本信息 + 操作 */}
      <Card className={classNames?.header}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--z-space-5)',
            flexWrap: 'wrap',
          }}
        >
          <Avatar src={user.avatarSrc} name={user.name} size={72} alt={user.name} />
          <div style={{ flex: '1 1 200px', minWidth: 0, overflowWrap: 'anywhere' }}>
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--z-text-xl)',
                fontWeight: 'var(--z-weight-semibold)',
                color: 'var(--z-color-fg)',
              }}
            >
              {user.name}
            </h2>
            <p
              style={{
                margin: 'var(--z-space-1) 0 0',
                fontSize: 'var(--z-text-sm)',
                color: 'var(--z-color-fg-muted)',
              }}
            >
              @{user.account}
              {user.role ? ` · ${user.role}` : ''}
            </p>
            {user.bio ? (
              <p
                style={{
                  margin: 'var(--z-space-2) 0 0',
                  fontSize: 'var(--z-text-sm)',
                  color: 'var(--z-color-fg-muted)',
                }}
              >
                {user.bio}
              </p>
            ) : null}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 'var(--z-space-2)',
            }}
          >
            <button type="button" style={actionButtonStyle} onClick={onEditProfile}>
              <EditIcon />
              编辑资料
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--z-space-1)' }}>
              <Upload
                accept="image/*"
                fileList={avatarFileList}
                defaultFileList={defaultAvatarFiles}
                onChange={onAvatarFilesChange}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs：资料 / 安全 / 偏好 */}
      <Card className={classNames?.tabs}>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <Tabs.List aria-label="个人中心">
            <Tabs.Trigger value="profile">资料</Tabs.Trigger>
            <Tabs.Trigger value="security">安全</Tabs.Trigger>
            <Tabs.Trigger value="preferences">偏好</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Panel value="profile" className={classNames?.panel}>
            <Descriptions title="基本资料" column={2} bordered>
              <Descriptions.Item label="姓名">{user.name}</Descriptions.Item>
              <Descriptions.Item label="账号">{user.account}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{user.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="手机">{user.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="部门">{user.department ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="所在地">{user.location ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="入职日期" span={2}>
                {user.joinDate ?? '—'}
              </Descriptions.Item>
            </Descriptions>
          </Tabs.Panel>

          <Tabs.Panel value="security" className={classNames?.panel}>
            <Descriptions title="安全设置" column={1} bordered>
              <Descriptions.Item label="最近改密">2025-11-02 14:30</Descriptions.Item>
              <Descriptions.Item label="登录设备">2 台活跃设备</Descriptions.Item>
            </Descriptions>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--z-space-4)',
                padding: 'var(--z-space-4) 0 0',
                marginTop: 'var(--z-space-4)',
                borderTop: '1px solid var(--z-color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--z-space-2)' }}>
                <span style={{ color: 'var(--z-color-fg-muted)', display: 'inline-flex' }}>
                  <ShieldIcon />
                </span>
                <div>
                  <div style={{ fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg)' }}>
                    登录二次验证
                  </div>
                  <div style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>
                    新设备登录时需要邮箱验证码确认
                  </div>
                </div>
              </div>
              <Switch
                checked={twoFactorEnabled}
                onChange={onTwoFactorChange}
                aria-label="登录二次验证"
              />
            </div>
            <div style={{ paddingTop: 'var(--z-space-4)' }}>
              <button type="button" style={actionButtonStyle} onClick={onChangePassword}>
                修改密码
              </button>
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="preferences" className={classNames?.panel}>
            <div
              className={classNames?.preferences}
              data-part="preferences"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--z-space-4)' }}
            >
              {preferences.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--z-text-sm)',
                    color: 'var(--z-color-fg-muted)',
                  }}
                >
                  暂无可配置偏好
                </p>
              ) : (
                preferences.map((item) => (
                  <div
                    key={item.key}
                    data-part="preference"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--z-space-4)',
                      padding: 'var(--z-space-3) var(--z-space-4)',
                      borderRadius: 'var(--z-radius-md)',
                      border: '1px solid var(--z-color-border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg)' }}>
                        {item.label}
                      </div>
                      {item.description ? (
                        <div
                          style={{
                            fontSize: 'var(--z-text-xs)',
                            color: 'var(--z-color-fg-muted)',
                            marginTop: 2,
                          }}
                        >
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                    <Switch
                      checked={item.checked}
                      onChange={(checked) => onPreferenceChange?.(item.key, checked)}
                      aria-label={item.label}
                    />
                  </div>
                ))
              )}
            </div>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  );
}

export default UserCenterBlock;
