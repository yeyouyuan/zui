'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './Form.css';

/* ---------------------------------- 类型 ---------------------------------- */

/** 字段校验规则 */
export interface FormRule {
  /** 必填 */
  required?: boolean;
  /** 自定义错误消息（覆盖默认文案） */
  message?: string;
  /** 数值范围（值为 number 时，含）或长度范围（字符串/数组长度，含） */
  min?: number;
  /** 数值范围（值为 number 时，含）或长度范围（字符串/数组长度，含） */
  max?: number;
  /** 正则格式校验 */
  pattern?: RegExp;
  /** 自定义校验：返回 false 或错误消息字符串表示不通过 */
  validator?: (value: unknown) => boolean | string;
}

export interface FormProps extends Omit<React.ComponentPropsWithRef<'form'>, 'onSubmit'> {
  /** 初始值（resetFields 归还的目标） */
  initialValues?: Record<string, unknown>;
  /** 全量校验通过时触发，携带聚合值 */
  onFinish?: (values: Record<string, unknown>) => void;
  /** 校验失败时触发，携带 { 字段名: 错误消息 } */
  onFinishFailed?: (errors: Record<string, string>) => void;
  children: React.ReactNode;
  className?: string;
  classNames?: { root?: string };
  /** 绑定 useForm() 实例（可选；不传时 Form 自建实例，可在 Form 内用 useForm() 获取） */
  form?: FormInstance;
}

export interface FormItemProps {
  /** 字段名（值收集与校验的 key） */
  name: string;
  /** 标签内容 */
  label?: React.ReactNode;
  /** 校验规则 */
  rules?: FormRule[];
  /** 必填标记（展示 * 并参与必填校验） */
  required?: boolean;
  /** 单个受控子元素（value/onChange/onBlur/id/aria-* 由 Form.Item 注入） */
  children: React.ReactElement;
  className?: string;
  classNames?: { item?: string; label?: string; control?: string; error?: string };
}

/** validateFields 的结果：全量值快照 + 错误映射（空对象表示通过） */
export interface FormValidateResult {
  values: Record<string, unknown>;
  errors: Record<string, string>;
}

/** useForm() 实例 */
export interface FormInstance {
  /** 校验指定字段（缺省全量）；总是 resolve，errors 非空表示有字段未通过 */
  validateFields: (names?: string[]) => Promise<FormValidateResult>;
  /** 合并写入字段值 */
  setFieldsValue: (values: Record<string, unknown>) => void;
  /** 读取字段值（缺省全量） */
  getFieldsValue: (names?: string[]) => Record<string, unknown>;
  /** 归还 initialValues 并清空错误 */
  resetFields: () => void;
  /** 滚动到指定字段并聚焦其控件 */
  scrollToField: (name: string) => void;
}

/* -------------------------------- 校验工具 -------------------------------- */

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function valueLength(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) return value.length;
  return 0;
}

/** 按规则校验单个值，返回错误消息（空串表示通过） */
function validateFormValue(
  rules: FormRule[],
  value: unknown,
  required: boolean,
  messages: import('../../config').ZuiLocale['form']
): string {
  const must = required || rules.some((rule) => rule.required);
  if (must && isEmptyValue(value)) {
    const requiredRule = rules.find((rule) => rule.required);
    return requiredRule?.message ?? messages.required;
  }
  if (isEmptyValue(value)) return '';

  for (const rule of rules) {
    if (rule.min !== undefined) {
      if (typeof value === 'number') {
        if (value < rule.min)
          return rule.message ?? messages.minNumber.replace('{min}', String(rule.min));
      } else if (valueLength(value) < rule.min) {
        return rule.message ?? messages.minLength.replace('{min}', String(rule.min));
      }
    }
    if (rule.max !== undefined) {
      if (typeof value === 'number') {
        if (value > rule.max)
          return rule.message ?? messages.maxNumber.replace('{max}', String(rule.max));
      } else if (valueLength(value) > rule.max) {
        return rule.message ?? messages.maxLength.replace('{max}', String(rule.max));
      }
    }
    if (rule.pattern && !rule.pattern.test(String(value))) {
      return rule.message ?? messages.pattern;
    }
    if (rule.validator) {
      const result = rule.validator(value);
      if (result === false) return rule.message ?? messages.validator;
      if (typeof result === 'string' && result !== '') return result;
    }
  }
  return '';
}

/* -------------------------------- 实例工厂 -------------------------------- */

interface FormImpl {
  validateFields: (names?: string[]) => FormValidateResult;
  setFieldsValue: (values: Record<string, unknown>) => void;
  getFieldsValue: (names?: string[]) => Record<string, unknown>;
  resetFields: () => void;
  scrollToField: (name: string) => void;
}

type InternalFormInstance = FormInstance & {
  /** @internal：由 Form 在渲染期绑定实现 */
  attach: (impl: FormImpl) => void;
};

function createFormInstance(): InternalFormInstance {
  let impl: FormImpl | null = null;
  return {
    attach: (next) => {
      impl = next;
    },
    validateFields: (names) =>
      impl
        ? Promise.resolve(impl.validateFields(names))
        : Promise.resolve({ values: {}, errors: {} }),
    setFieldsValue: (values) => impl?.setFieldsValue(values),
    getFieldsValue: (names) => (impl ? impl.getFieldsValue(names) : {}),
    resetFields: () => impl?.resetFields(),
    scrollToField: (name) => impl?.scrollToField(name),
  };
}

/* --------------------------------- Context -------------------------------- */

interface FormContextValue {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  instance: InternalFormInstance;
  registerField: (name: string, rules: FormRule[], required: boolean) => void;
  unregisterField: (name: string) => void;
  setFieldValue: (name: string, value: unknown) => void;
  validateOnBlur: (name: string) => void;
  controlId: (name: string) => string;
  errorId: (name: string) => string;
}

const FormContext = React.createContext<FormContextValue | null>(null);

/**
 * useForm()：Form 内部调用返回当前表单实例；
 * 在 Form 外部调用创建独立实例，配合 `<Form form={form}>` 绑定。
 */
export function useForm(): FormInstance {
  const ctx = React.useContext(FormContext);
  const fallbackRef = React.useRef<InternalFormInstance | null>(null);
  if (fallbackRef.current === null) fallbackRef.current = createFormInstance();
  return ctx ? ctx.instance : fallbackRef.current;
}

/* ---------------------------------- Form ---------------------------------- */

function Form(props: FormProps) {
  const { locale } = useZuiConfig();
  const {
    initialValues,
    onFinish,
    onFinishFailed,
    children,
    className,
    classNames,
    form,
    ...rest
  } = props;

  const internalRef = React.useRef<InternalFormInstance | null>(null);
  if (internalRef.current === null) internalRef.current = createFormInstance();
  const instance = (form as InternalFormInstance | undefined) ?? internalRef.current;

  const initialRef = React.useRef<Record<string, unknown>>({ ...(initialValues ?? {}) });
  const valuesRef = React.useRef<Record<string, unknown>>({ ...initialRef.current });
  const errorsRef = React.useRef<Record<string, string>>({});
  const fieldsRef = React.useRef(new Map<string, { rules: FormRule[]; required: boolean }>());
  const [, rerender] = React.useReducer((tick: number) => tick + 1, 0);
  const rootRef = React.useRef<HTMLFormElement | null>(null);
  const idPrefix = React.useId();

  /* ------------------------------ 字段注册表 ------------------------------ */

  const registerField = React.useCallback((name: string, rules: FormRule[], required: boolean) => {
    fieldsRef.current.set(name, { rules, required });
  }, []);

  // 注销只清字段注册表，不清 errorsRef：FormItem 的 effect 会随 rules 引用变化
  // 重复 cleanup→setup，若在此删除错误会吞掉 runValidate 刚算出的结果。
  // 错误映射由 runValidate 按本次校验目标重建（见下），卸载字段的陈旧错误不会外泄。
  const unregisterField = React.useCallback((name: string) => {
    fieldsRef.current.delete(name);
  }, []);

  const setFieldValue = React.useCallback((name: string, value: unknown) => {
    valuesRef.current[name] = value;
    rerender();
  }, []);

  const validateFieldByName = React.useCallback(
    (name: string): string => {
      const field = fieldsRef.current.get(name);
      if (!field) return '';
      const error = validateFormValue(
        field.rules,
        valuesRef.current[name],
        field.required,
        locale.form
      );
      if (error) errorsRef.current[name] = error;
      else delete errorsRef.current[name];
      return error;
    },
    [locale.form]
  );

  const runValidate = React.useCallback(
    (names?: string[]): FormValidateResult => {
      const targets = names ?? Array.from(fieldsRef.current.keys());
      const errors: Record<string, string> = {};
      for (const name of targets) {
        const error = validateFieldByName(name);
        if (error) errors[name] = error;
      }
      rerender();
      const values: Record<string, unknown> = { ...valuesRef.current };
      for (const name of fieldsRef.current.keys()) {
        if (!(name in values)) values[name] = undefined;
      }
      return { values, errors };
    },
    [validateFieldByName]
  );

  const validateOnBlur = React.useCallback(
    (name: string) => {
      validateFieldByName(name);
      rerender();
    },
    [validateFieldByName]
  );

  /* ------------------------------ 命令式 API ------------------------------ */

  instance.attach({
    validateFields: (names) => runValidate(names),
    setFieldsValue: (next) => {
      Object.assign(valuesRef.current, next);
      rerender();
    },
    getFieldsValue: (names) => {
      const all: Record<string, unknown> = { ...valuesRef.current };
      for (const name of fieldsRef.current.keys()) {
        if (!(name in all)) all[name] = undefined;
      }
      if (!names) return all;
      const picked: Record<string, unknown> = {};
      for (const name of names) picked[name] = all[name];
      return picked;
    },
    resetFields: () => {
      valuesRef.current = { ...initialRef.current };
      errorsRef.current = {};
      rerender();
    },
    scrollToField: (name) => {
      const root = rootRef.current;
      if (!root) return;
      let item: HTMLElement | null = null;
      for (const el of root.querySelectorAll<HTMLElement>('[data-field]')) {
        if (el.getAttribute('data-field') === name) {
          item = el;
          break;
        }
      }
      if (!item) return;
      item.scrollIntoView?.({ block: 'center' });
      item.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]')?.focus();
    },
  });

  /* -------------------------------- 提交 --------------------------------- */

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { values, errors } = runValidate();
    if (Object.keys(errors).length === 0) onFinish?.(values);
    else onFinishFailed?.(errors);
  };

  const contextValue: FormContextValue = {
    values: valuesRef.current,
    errors: errorsRef.current,
    instance,
    registerField,
    unregisterField,
    setFieldValue,
    validateOnBlur,
    controlId: (name) => `${idPrefix}-field-${name}`,
    errorId: (name) => `${idPrefix}-field-${name}-error`,
  };

  return (
    <FormContext.Provider value={contextValue}>
      <form
        {...rest}
        ref={rootRef}
        data-part="root"
        className={cx('z-form', className, classNames?.root)}
        onSubmit={handleSubmit}
        noValidate
      >
        {children}
      </form>
    </FormContext.Provider>
  );
}

/* -------------------------------- Form.Item ------------------------------- */

function FormItem(props: FormItemProps) {
  const { name, label, rules, required, children, className, classNames } = props;
  const ctx = React.useContext(FormContext);

  // 注册/注销都在 effect 内（幂等）：StrictMode 的 setup→cleanup→setup 双调用后
  // 注册表仍完整，表单校验不会静默失效。rules 引用每次渲染变化时会重复注册
  // （Map.set 幂等，开销可忽略），保证 rules 始终为最新。
  React.useEffect(() => {
    if (!ctx) return undefined;
    ctx.registerField(name, rules ?? [], required ?? false);
    return () => ctx.unregisterField(name);
  }, [ctx, name, rules, required]);

  if (!ctx) {
    throw new Error('[ZUI] Form.Item 必须作为 <Form> 的后代使用');
  }

  const error = ctx.errors[name];
  const errorId = ctx.errorId(name);
  const isRequired = Boolean(required || rules?.some((rule) => rule.required));

  const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
  const childProps = child.props;
  const controlId = typeof childProps.id === 'string' ? childProps.id : ctx.controlId(name);
  const isCheckboxLike =
    childProps.type === 'checkbox' ||
    childProps.type === 'radio' ||
    'checked' in childProps ||
    'defaultChecked' in childProps;

  const handleControlChange = (...args: unknown[]) => {
    (childProps.onChange as ((...a: unknown[]) => void) | undefined)?.(...args);
    const first = args[0];
    let next: unknown;
    if (first !== null && typeof first === 'object' && 'target' in first) {
      const target = (first as React.ChangeEvent<HTMLInputElement>).target;
      next = target.type === 'checkbox' || target.type === 'radio' ? target.checked : target.value;
    } else {
      next = first;
    }
    ctx.setFieldValue(name, next);
  };

  const handleControlBlur = (event: React.FocusEvent) => {
    (childProps.onBlur as ((e: React.FocusEvent) => void) | undefined)?.(event);
    if (!event.defaultPrevented) ctx.validateOnBlur(name);
  };

  const describedBy =
    [childProps['aria-describedby'], error ? errorId : null].filter(Boolean).join(' ') || undefined;

  const injected: Record<string, unknown> = {
    id: controlId,
    name,
    onChange: handleControlChange,
    onBlur: handleControlBlur,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
  };
  if (isCheckboxLike) injected.checked = Boolean(ctx.values[name]);
  else injected.value = ctx.values[name] ?? '';
  if (isRequired) injected['aria-required'] = true;

  return (
    <div
      data-part="item"
      data-field={name}
      className={cx('z-form-item', className, classNames?.item)}
    >
      {label != null ? (
        <label
          data-part="label"
          className={cx('z-form-item-label', classNames?.label)}
          htmlFor={controlId}
        >
          {isRequired ? (
            <span className="z-form-item-required" aria-hidden="true">
              *
            </span>
          ) : null}
          {label}
        </label>
      ) : null}
      <div data-part="control" className={cx('z-form-item-control', classNames?.control)}>
        {React.cloneElement(child, injected)}
        {error ? (
          <div
            data-part="error"
            id={errorId}
            className={cx('z-form-item-error', classNames?.error)}
          >
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------- Compound -------------------------------- */

const FormRoot = Object.assign(Form, {
  Item: FormItem,
});

export { FormRoot as Form, FormItem };
