'use client';

import * as React from 'react';
import { Button, Card, Descriptions, Input, Select, Steps, useControllableState } from '@zui/react';
import type { StepsItem } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

/** 向导聚合值（数据 props 化） */
export interface WizardValues {
  /** 第一步：项目名称 */
  name: string;
  /** 第一步：项目编号 */
  code: string;
  /** 第二步：项目类别 */
  category: string;
  /** 第二步：负责人 */
  owner: string;
}

export interface WizardBlockProps {
  /** 步骤条配置（默认内置三步） */
  steps?: StepsItem[];
  /** 当前步骤下标（受控，0 起始） */
  current?: number;
  defaultCurrent?: number;
  onCurrentChange?: (index: number) => void;
  /** 表单聚合值（受控） */
  values: WizardValues;
  /** 部分字段变更回调 */
  onValuesChange?: (patch: Partial<WizardValues>) => void;
  /** 类别下拉选项 */
  categoryOptions?: { value: string; label: string }[];
  finishText?: string;
  nextText?: string;
  prevText?: string;
  /** 最后一步点击完成 */
  onFinish?: (values: WizardValues) => void;
  onCancel?: () => void;
  cancelText?: string;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; body?: string; footer?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_WIZARD_STEPS: StepsItem[] = [
  { key: 'basic', title: '基本信息', description: '项目名称与编号' },
  { key: 'config', title: '项目配置', description: '类别与负责人' },
  { key: 'confirm', title: '确认创建', description: '核对并完成' },
];

export const DEMO_WIZARD_VALUES: WizardValues = {
  name: '',
  code: '',
  category: '',
  owner: '',
};

export const DEMO_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'platform', label: '平台组件' },
  { value: 'data', label: '数据产品' },
  { value: 'growth', label: '增长实验' },
];

/* ---------------------------------- 区块 ---------------------------------- */

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--z-text-sm)',
  fontWeight: 'var(--z-weight-medium)',
  color: 'var(--z-color-fg)',
  marginBottom: 'var(--z-space-2)',
};

/** 分步向导区块：Steps + 三步表单（下一步/上一步，最后一步完成回调） */
export function WizardBlock({
  steps = DEMO_WIZARD_STEPS,
  current: currentProp,
  defaultCurrent = 0,
  onCurrentChange,
  values,
  onValuesChange,
  categoryOptions = DEMO_CATEGORY_OPTIONS,
  finishText = '完成创建',
  nextText = '下一步',
  prevText = '上一步',
  onFinish,
  onCancel,
  cancelText = '取消',
  className,
  style,
  classNames,
}: WizardBlockProps) {
  // useControllableState 在受控/非受控下都会回调 onChange，无需显式转发
  const [current, setCurrent] = useControllableState<number>({
    value: currentProp,
    defaultValue: defaultCurrent,
    onChange: onCurrentChange,
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const setField = (key: keyof WizardValues, value: string) => {
    onValuesChange?.({ [key]: value });
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /** 步骤级校验：必填项为空则阻断前进 */
  const validateStep = (index: number): boolean => {
    const next: Record<string, string> = {};
    if (index === 0) {
      if (values.name.trim() === '') next.name = '请输入项目名称';
      if (values.code.trim() === '') next.code = '请输入项目编号';
    }
    if (index === 1) {
      if (values.category === '') next.category = '请选择项目类别';
      if (values.owner.trim() === '') next.owner = '请输入负责人';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(current)) return;
    setCurrent(Math.min(current + 1, steps.length - 1));
  };

  const goPrev = () => {
    setErrors({});
    setCurrent(Math.max(current - 1, 0));
  };

  const handleFinish = () => {
    if (!validateStep(1)) {
      setCurrent(1);
      return;
    }
    onFinish?.(values);
  };

  const errorTextStyle: React.CSSProperties = {
    marginTop: 'var(--z-space-1)',
    fontSize: 'var(--z-text-xs)',
    color: 'var(--z-color-danger)',
  };

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--z-space-5)',
        maxWidth: 640,
        margin: '0 auto',
        padding: 'var(--z-space-6) var(--z-space-4)',
        ...style,
      }}
    >
      <Steps items={steps} current={current} />

      <Card className={classNames?.body}>
        {/* 第一步：基本信息 */}
        {current === 0 ? (
          <section data-part="step" data-step="0" aria-label="基本信息">
            <div style={{ marginBottom: 'var(--z-space-4)' }}>
              <label htmlFor="wizard-name" style={fieldLabelStyle}>
                项目名称
              </label>
              <Input
                id="wizard-name"
                name="name"
                status={errors.name ? 'error' : 'default'}
                value={values.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder="如：ZUI 组件库"
              />
              {errors.name ? (
                <div role="alert" style={errorTextStyle}>
                  {errors.name}
                </div>
              ) : null}
            </div>
            <div>
              <label htmlFor="wizard-code" style={fieldLabelStyle}>
                项目编号
              </label>
              <Input
                id="wizard-code"
                name="code"
                status={errors.code ? 'error' : 'default'}
                value={values.code}
                onChange={(event) => setField('code', event.target.value)}
                placeholder="如：prj-001"
              />
              {errors.code ? (
                <div role="alert" style={errorTextStyle}>
                  {errors.code}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* 第二步：项目配置 */}
        {current === 1 ? (
          <section data-part="step" data-step="1" aria-label="项目配置">
            <div style={{ marginBottom: 'var(--z-space-4)' }}>
              <span style={fieldLabelStyle}>项目类别</span>
              <span style={{ display: 'block' }}>
                <Select
                  id="wizard-category"
                  aria-label="项目类别"
                  options={categoryOptions}
                  value={values.category}
                  placeholder="请选择项目类别"
                  onChange={(value) => setField('category', value)}
                />
              </span>
              {errors.category ? (
                <div role="alert" style={errorTextStyle}>
                  {errors.category}
                </div>
              ) : null}
            </div>
            <div>
              <label htmlFor="wizard-owner" style={fieldLabelStyle}>
                负责人
              </label>
              <Input
                id="wizard-owner"
                name="owner"
                status={errors.owner ? 'error' : 'default'}
                value={values.owner}
                onChange={(event) => setField('owner', event.target.value)}
                placeholder="如：林小满"
              />
              {errors.owner ? (
                <div role="alert" style={errorTextStyle}>
                  {errors.owner}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* 第三步：确认创建 */}
        {current === 2 ? (
          <section data-part="step" data-step="2" aria-label="确认创建">
            <Descriptions title="确认项目信息" column={1} bordered>
              <Descriptions.Item label="项目名称">{values.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="项目编号">{values.code || '—'}</Descriptions.Item>
              <Descriptions.Item label="项目类别">
                {categoryOptions.find((option) => option.value === values.category)?.label ??
                  values.category ??
                  '—'}
              </Descriptions.Item>
              <Descriptions.Item label="负责人">{values.owner || '—'}</Descriptions.Item>
            </Descriptions>
          </section>
        ) : null}

        {/* 底部操作区 */}
        <div
          className={classNames?.footer}
          data-part="footer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--z-space-3)',
            paddingTop: 'var(--z-space-5)',
            marginTop: 'var(--z-space-2)',
            borderTop: '1px solid var(--z-color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--z-space-3)' }}>
            {onCancel != null && current === 0 ? (
              <Button variant="outline" onClick={onCancel}>
                {cancelText}
              </Button>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 'var(--z-space-3)' }}>
            {current > 0 ? (
              <Button variant="outline" onClick={goPrev}>
                {prevText}
              </Button>
            ) : null}
            {current < steps.length - 1 ? (
              <Button type="button" onClick={goNext}>
                {nextText}
              </Button>
            ) : (
              <Button type="button" onClick={handleFinish}>
                {finishText}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default WizardBlock;
