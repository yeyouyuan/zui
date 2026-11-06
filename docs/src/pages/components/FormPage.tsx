import { useState } from 'react';
import { Button, Form, Input, useForm } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const VALIDATE_CODE = `function Demo() {
  const form = useForm();
  return (
    <Form
      form={form}
      initialValues={{ username: '', email: '' }}
      onFinish={(values) => console.log('通过：', values)}
      onFinishFailed={(errors) => console.log('失败：', errors)}
    >
      <Form.Item
        name="username"
        label="用户名"
        required
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input placeholder="请输入用户名" />
      </Form.Item>
      <Form.Item
        name="email"
        label="邮箱"
        rules={[{ pattern: /^[^@]+@[^@]+$/, message: '邮箱格式不正确' }]}
      >
        <Input placeholder="请输入邮箱" />
      </Form.Item>
      <Button type="submit" variant="primary">提交</Button>
    </Form>
  );
}`;

const RULES_CODE = `rules={[
  { required: true, message: '必填' },
  { min: 2, max: 16, message: '长度 2-16' },
  { pattern: /^\\d+$/, message: '仅数字' },
  { validator: (v) => v !== 'admin' || '不能使用 admin' },
]}`;

const INSTANCE_CODE = `const form = useForm();

<Button onClick={() => form.setFieldsValue({ username: '张三' })}>填充</Button>
<Button onClick={() => form.resetFields()}>重置</Button>
<Button onClick={() => form.scrollToField('username')}>定位</Button>`;

function ValidateDemo() {
  const form = useForm();
  const [result, setResult] = useState('');

  return (
    <Form
      form={form}
      initialValues={{ username: '', email: '' }}
      onFinish={(values: Record<string, unknown>) => setResult(`提交成功：${JSON.stringify(values)}`)}
      onFinishFailed={(errors: Record<string, string>) => setResult(`校验失败：${Object.values(errors).join('；')}`)}
    >
      <Form.Item
        name="username"
        label="用户名"
        required
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input placeholder="请输入用户名" />
      </Form.Item>
      <Form.Item
        name="email"
        label="邮箱"
        rules={[{ pattern: /^[^@]+@[^@]+$/, message: '邮箱格式不正确' }]}
      >
        <Input placeholder="请输入邮箱" />
      </Form.Item>
      <Button type="submit" variant="primary">提交</Button>
      {result ? <p className="doc-p">{result}</p> : null}
    </Form>
  );
}

function InstanceDemo() {
  const form = useForm();
  const [log, setLog] = useState('');

  return (
    <div>
      <Form form={form} initialValues={{ username: '' }}>
        <Form.Item name="username" label="用户名">
          <Input placeholder="点击右侧按钮操作" />
        </Form.Item>
      </Form>
      <div className="doc-pg-preview-row">
        <Button
          onClick={() => {
            form.setFieldsValue({ username: '张三' });
            setLog('已填充');
          }}
        >
          填充
        </Button>
        <Button
          onClick={() => {
            form.resetFields();
            setLog('已重置');
          }}
        >
          重置
        </Button>
        <Button
          onClick={() => {
            form.scrollToField('username');
            setLog('已定位');
          }}
        >
          定位
        </Button>
      </div>
      {log ? <p className="doc-p">{log}</p> : null}
    </div>
  );
}

export default function FormPage(): React.ReactNode {
  usePageTitle('Form 表单');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Form 表单</h1>
      <p className="doc-lead">表单容器：字段注册、value/onChange 注入、blur/submit 校验与错误聚合。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="校验与提交"
        description="Form.Item 用 Context 把 name/value/onChange/校验错误注入单子元素；blur 时校验该字段、submit 时全量校验，错误红字 + aria-invalid + aria-describedby。"
        code={VALIDATE_CODE}
        stack
      >
        <ValidateDemo />
      </Demo>

      <Demo title="校验规则" description="FormRule 支持 required / message / min / max / pattern / validator。" code={RULES_CODE}>
        <p className="doc-p">
          规则对象示例见代码区：<code className="doc-code-inline">required</code>、
          <code className="doc-code-inline">min/max</code>（长度或数值范围，含）、
          <code className="doc-code-inline">pattern</code>、
          <code className="doc-code-inline">validator</code>（返回 false 或错误消息）。
        </p>
      </Demo>

      <Demo title="表单实例" description="useForm() 返回实例：validateFields / setFieldsValue / getFieldsValue / resetFields / scrollToField。" code={INSTANCE_CODE} stack>
        <InstanceDemo />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'initialValues',
            type: 'Record<string, unknown>',
            description: '初始值（resetFields 归还的目标）。',
          },
          {
            name: 'onFinish',
            type: '(values: Record<string, unknown>) => void',
            description: '全量校验通过时触发，携带聚合值。',
          },
          {
            name: 'onFinishFailed',
            type: '(errors: Record<string, string>) => void',
            description: '校验失败时触发，携带 { 字段名: 错误消息 }。',
          },
          {
            name: 'form',
            type: 'FormInstance',
            description: '绑定 useForm() 实例（可选；不传时 Form 自建实例）。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '表单内容。',
          },
          {
            name: 'classNames',
            type: '{ root? }',
            description: 'slot 级类名追加（root）。',
          },
        ]}
      />
      <p className="doc-p">
        <code className="doc-code-inline">Form.Item</code>：{' '}
        <code className="doc-code-inline">{'{ name; label?; rules?: FormRule[]; required?; children: React.ReactElement; classNames?: { item?; label?; control?; error? } }'}</code>
        。
      </p>
      <p className="doc-p">
        <code className="doc-code-inline">useForm()</code>：{' '}
        <code className="doc-code-inline">
          {'{ validateFields, setFieldsValue, getFieldsValue, resetFields, scrollToField }'}
        </code>
        。
      </p>

      <CustomizeOutlet
        name="Form"
        parts={['root', 'item', 'label', 'control', 'error']}
        vars={[
          '--z-form-item-gap',
          '--z-form-label-color',
          '--z-form-label-font-size',
          '--z-form-label-font-weight',
          '--z-form-label-margin-bottom',
          '--z-form-required-color',
          '--z-form-error-color',
          '--z-form-error-font-size',
          '--z-form-error-margin-top',
        ]}
      />
    </div>
  );
}
