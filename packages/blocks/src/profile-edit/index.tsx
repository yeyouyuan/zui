'use client';

import * as React from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  DateRangePicker,
  Input,
  Row,
  Upload,
  useControllableState,
} from '@zui/react';
import type { UploadChangeInfo, UploadFile } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

/** 资料编辑值（数据 props 化） */
export interface ProfileEditValues {
  name: string;
  nickname: string;
  email: string;
  phone: string;
  /** 岗位 / 职位 */
  position: string;
  /** 个人简介 */
  bio: string;
}

export interface ProfileEditBlockProps {
  /** 表单值（受控） */
  values: ProfileEditValues;
  /** 部分字段变更回调 */
  onChange?: (patch: Partial<ProfileEditValues>) => void;
  /** 任职时间（DateRangePicker，受控；null = 未选择） */
  tenure?: [string, string] | null;
  defaultTenure?: [string, string];
  onTenureChange?: (range: [string, string] | null) => void;
  /** 头像上传（受控文件列表） */
  avatarFileList?: UploadFile[];
  defaultAvatarFiles?: UploadFile[];
  onAvatarFilesChange?: (info: UploadChangeInfo) => void;
  /** 头像预览地址（无图按姓名首字回退） */
  avatarSrc?: string;
  saveText?: string;
  saving?: boolean;
  onSave?: (values: ProfileEditValues) => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; form?: string; aside?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_PROFILE: ProfileEditValues = {
  name: '林小满',
  nickname: '小满',
  email: 'xiaoman.lin@example.com',
  phone: '+86 138 0000 0000',
  position: '前端工程师',
  bio: '负责 ZUI 组件库与设计系统工程化建设。',
};

export const DEMO_TENURE: [string, string] = ['2023-06-12', '2026-06-12'];

/* --------------------------------- 小图标 --------------------------------- */

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/* ---------------------------------- 区块 ---------------------------------- */

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--z-text-sm)',
  fontWeight: 'var(--z-weight-medium)',
  color: 'var(--z-color-fg)',
  marginBottom: 'var(--z-space-2)',
};

/** 资料编辑区块：Row/Col 表单布局 + Upload 头像上传 + DateRangePicker 任职时间 */
export function ProfileEditBlock({
  values,
  onChange,
  tenure: tenureProp,
  defaultTenure,
  onTenureChange,
  avatarFileList,
  defaultAvatarFiles,
  onAvatarFilesChange,
  avatarSrc,
  saveText = '保存资料',
  saving = false,
  onSave,
  className,
  style,
  classNames,
}: ProfileEditBlockProps) {
  const idPrefix = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const fieldId = (name: string) => `profile-${idPrefix}-${name}`;

  // useControllableState 在受控/非受控下都会回调 onChange，无需显式转发
  const [tenure, setTenure] = useControllableState<[string, string] | null>({
    value: tenureProp,
    defaultValue: defaultTenure ?? null,
    onChange: onTenureChange,
  });

  const setField = (key: keyof ProfileEditValues, value: string) => {
    onChange?.({ [key]: value });
  };

  const renderField = (
    name: keyof ProfileEditValues,
    label: string,
    placeholder?: string,
    span = 12
  ) => (
    <Col span={span} style={{ marginBottom: 'var(--z-space-4)' }}>
      <label htmlFor={fieldId(name)} style={fieldLabelStyle}>
        {label}
      </label>
      <Input
        id={fieldId(name)}
        name={name}
        value={values[name]}
        onChange={(event) => setField(name, event.target.value)}
        placeholder={placeholder}
      />
    </Col>
  );

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: 'var(--z-space-6) var(--z-space-4)',
        ...style,
      }}
    >
      <Card>
        <h2
          style={{
            margin: '0 0 var(--z-space-5)',
            fontSize: 'var(--z-text-lg)',
            fontWeight: 'var(--z-weight-semibold)',
            color: 'var(--z-color-fg)',
          }}
        >
          编辑个人资料
        </h2>

        <Row gutter={[24, 0]} className={classNames?.form}>
          {/* 左：表单区 */}
          <Col span={17}>
            <Row gutter={[16, 0]}>
              {renderField('name', '姓名', '请输入姓名')}
              {renderField('nickname', '昵称', '请输入昵称')}
              {renderField('email', '邮箱', 'name@example.com')}
              {renderField('phone', '手机号', '+86')}
              {renderField('position', '岗位', '如：前端工程师')}
              {renderField('bio', '个人简介', '一句话介绍自己', 24)}

              {/* 任职时间 */}
              <Col span={24}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--z-space-2)',
                    marginBottom: 'var(--z-space-2)',
                    fontSize: 'var(--z-text-sm)',
                    fontWeight: 'var(--z-weight-medium)',
                    color: 'var(--z-color-fg)',
                  }}
                >
                  <span style={{ display: 'inline-flex', color: 'var(--z-color-fg-muted)' }}>
                    <CalendarIcon />
                  </span>
                  任职时间
                </div>
                <DateRangePicker
                  aria-label="任职时间"
                  value={tenure}
                  onChange={setTenure}
                />
              </Col>
            </Row>
          </Col>

          {/* 右：头像上传 */}
          <Col span={7} className={classNames?.aside}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--z-space-4)',
                padding: 'var(--z-space-4)',
                borderRadius: 'var(--z-radius-lg)',
                border: '1px dashed var(--z-color-border)',
                background: 'var(--z-color-bg-subtle)',
              }}
            >
              <Avatar src={avatarSrc} name={values.name} size={80} alt={values.name} />
              <div
                style={{
                  fontSize: 'var(--z-text-xs)',
                  color: 'var(--z-color-fg-muted)',
                  textAlign: 'center',
                }}
              >
                支持 JPG / PNG，不超过 2MB
              </div>
              <Upload
                accept="image/*"
                maxCount={1}
                fileList={avatarFileList}
                defaultFileList={defaultAvatarFiles}
                onChange={onAvatarFilesChange}
              />
            </div>
          </Col>
        </Row>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: 'var(--z-space-4)',
            borderTop: '1px solid var(--z-color-border-subtle)',
            marginTop: 'var(--z-space-2)',
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

export default ProfileEditBlock;
