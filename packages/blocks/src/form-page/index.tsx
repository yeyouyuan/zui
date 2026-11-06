'use client';

import * as React from 'react';
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Divider,
  Form,
  Input,
  Select,
  Switch,
  Tag,
} from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export interface FormPageValues {
  name: string;
  code: string;
  owner: string;
  department: string;
  type: string;
  priority: string;
  phone: string;
  email: string;
  description: string;
  notify: boolean;
  enabled: boolean;
  agreed: boolean;
  /** 计划开始日期（ISO YYYY-MM-DD），可选以保持现有调用兼容 */
  plannedDate?: string;
}

export interface FormPageBlockProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 表单内容模式：create 新建 / edit 编辑（右上角 Tag） */
  mode?: 'create' | 'edit';
  loading?: boolean;
  submitText?: string;
  cancelText?: string;
  onSubmit?: (values: FormPageValues) => void;
  onCancel?: () => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; form?: string; section?: string; footer?: string };
}

/* ------------------------------- 受控字段组 ------------------------------- */

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--z-text-sm)',
  fontWeight: 'var(--z-weight-medium)',
  color: 'var(--z-color-fg)',
  marginBottom: 'var(--z-space-2)',
};

const hintStyle: React.CSSProperties = {
  marginTop: 'var(--z-space-2)',
  fontSize: 'var(--z-text-xs)',
  color: 'var(--z-color-fg-subtle)',
};

function Field({
  label,
  required,
  hint,
  children,
  htmlFor,
  name,
}: {
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactElement;
  htmlFor?: string;
  name?: keyof FormPageValues;
}) {
  return (
    <div>
      {name ? (
        <Form.Item name={name} label={label} required={required} rules={name === 'email' ? [{ pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入有效的电子邮箱' }] : name === 'description' ? [{ max: 500, message: '描述不能超过 500 字' }] : undefined}>
          {children}
        </Form.Item>
      ) : <><label style={labelStyle} htmlFor={htmlFor}>{label}</label>{children}</>}
      {hint != null ? <div style={hintStyle}>{hint}</div> : null}
    </div>
  );
}

/** 表单页区块：Form + 受控字段 + DatePicker 页面骨架 */
export function FormPageBlock({
  title = '新建项目',
  subtitle = '带 * 的字段为必填项',
  mode = 'create',
  loading = false,
  submitText = '提交',
  cancelText = '取消',
  onSubmit,
  onCancel,
  className,
  style,
  classNames,
}: FormPageBlockProps) {
  const [values, setValues] = React.useState<FormPageValues>({
    name: '',
    code: '',
    owner: '',
    department: '',
    type: 'project',
    priority: 'medium',
    phone: '',
    email: '',
    description: '',
    notify: true,
    enabled: true,
    agreed: false,
    plannedDate: '',
  });

  const set = <K extends keyof FormPageValues>(key: K, value: FormPageValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        padding: 'clamp(var(--z-space-3), 3vw, var(--z-space-6))',
        background: 'var(--z-color-bg-muted)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--z-space-4)',
        ...style,
      }}
    >
      {/* 页头 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--z-space-3)', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--z-text-xl)', fontWeight: 'var(--z-weight-semibold)', color: 'var(--z-color-fg)' }}>
          {title}
        </h1>
        <Tag color={mode === 'edit' ? 'warning' : 'primary'}>{mode === 'edit' ? '编辑' : '新建'}</Tag>
        <span style={{ fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg-muted)' }}>{subtitle}</span>
      </header>

      <Form initialValues={{ ...values }} onFinish={(fields) => {
        if (!loading && values.agreed) onSubmit?.({
          ...values,
          ...fields,
          code: String(fields.code ?? values.code).toUpperCase(),
          notify: values.notify,
          enabled: values.enabled,
          agreed: values.agreed,
          plannedDate: values.plannedDate,
        });
      }} className={classNames?.form}>
        {/* 基本信息 */}
        <Card title="基本信息" className={classNames?.section}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
              gap: 'var(--z-space-5)',
            }}
          >
            <Field name="name" label="项目名称" required>
              <Input

                name="name"
                required
                placeholder="请输入项目名称"
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field name="code" label="项目编码" required hint="字母在提交时转为大写">
              <Input

                name="code"
                required
                placeholder="如 PRJ-2026-001"
                value={values.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
              />
            </Field>
            <Field name="owner" label="负责人" required>
              <Input

                name="owner"
                required
                placeholder="请输入负责人姓名"
                value={values.owner}
                onChange={(e) => set('owner', e.target.value)}
              />
            </Field>
            <Field name="department" label="所属部门">
              <Select
                name="department"
                placeholder="请选择所属部门"
                aria-label="所属部门"
                value={values.department}
                onChange={(v) => set('department', v)}
                options={[
                  { value: 'rd', label: '研发中心' },
                  { value: 'design', label: '设计中心' },
                  { value: 'ops', label: '运营中心' },
                  { value: 'hr', label: '人力资源' },
                ]}
              />
            </Field>
            <Field name="type" label="项目类型">
              <Select
                name="type"
                aria-label="项目类型"
                value={values.type}
                onChange={(v) => set('type', v)}
                options={[
                  { value: 'project', label: '正式项目' },
                  { value: 'trial', label: '试点项目' },
                  { value: 'maintain', label: '维护任务' },
                ]}
              />
            </Field>
            <Field name="priority" label="优先级">
              <Select
                name="priority"
                aria-label="优先级"
                value={values.priority}
                onChange={(v) => set('priority', v)}
                options={[
                  { value: 'high', label: '高' },
                  { value: 'medium', label: '中' },
                  { value: 'low', label: '低' },
                ]}
              />
            </Field>
            <Field name="plannedDate" label="计划开始日期" hint="可选，使用本地日期格式">
              <DatePicker
                value={values.plannedDate ?? ''}
                onChange={(value) => set('plannedDate', value)}
                placeholder="请选择开始日期"
              />
            </Field>
          </div>
        </Card>

        {/* 联系方式 */}
        <Card title="联系方式" className={classNames?.section} style={{ marginTop: 'var(--z-space-4)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
              gap: 'var(--z-space-5)',
            }}
          >
            <Field name="phone" label="联系电话">
              <Input

                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="请输入手机号"
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
            <Field name="email" label="电子邮箱" hint="用于接收项目进度通知">
              <Input

                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
          </div>

          <div style={{ marginTop: 'var(--z-space-5)' }}>
            <Field name="description" label="项目描述" hint="简要描述项目背景与目标，不超过 500 字">
              <textarea

                name="description"
                rows={4}
                placeholder="请输入项目描述"
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 'var(--z-space-3) var(--z-space-4)',
                  fontSize: 'var(--z-text-md)',
                  lineHeight: 'var(--z-leading-normal)',
                  color: 'var(--z-color-fg)',
                  background: 'var(--z-color-bg-elevated)',
                  border: '1px solid var(--z-color-border)',
                  borderRadius: 'var(--z-radius-md)',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </Field>
          </div>
        </Card>

        {/* 通知与状态 */}
        <Card title="通知与状态" className={classNames?.section} style={{ marginTop: 'var(--z-space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--z-space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--z-space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg)' }}>进度通知</div>
                <div style={hintStyle}>项目状态变化时通过邮件通知相关成员</div>
              </div>
              <Switch
                checked={values.notify}
                onChange={(checked) => set('notify', checked)}
                aria-label="进度通知"
              />
            </div>
            <Divider style={{ margin: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--z-space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg)' }}>立即启用</div>
                <div style={hintStyle}>关闭后项目以草稿状态保存</div>
              </div>
              <Switch
                checked={values.enabled}
                onChange={(checked) => set('enabled', checked)}
                aria-label="立即启用"
              />
            </div>
            <Divider style={{ margin: 0 }} />
            <Checkbox
              checked={values.agreed}
              onChange={(checked) => set('agreed', checked)}
              label="我已阅读并同意《项目管理规范》"
            />
          </div>
        </Card>

        {/* 底部操作 */}
        <div
          data-part="footer"
          className={classNames?.footer}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 'var(--z-space-3)',
            marginTop: 'var(--z-space-5)',
            padding: 'var(--z-space-4) var(--z-space-5)',
            background: 'var(--z-color-bg-elevated)',
            borderRadius: 'var(--z-radius-md)',
            border: '1px solid var(--z-color-border-subtle)',
            position: 'sticky',
            bottom: 'var(--z-space-4)',
          }}
        >
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button type="submit" loading={loading} disabled={!values.agreed}>
            {submitText}
          </Button>
        </div>
      </Form>
    </div>
  );
}

export default FormPageBlock;
