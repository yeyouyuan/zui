import * as React from 'react';
import { createRoot } from 'react-dom/client';
import '@zui/react/styles.css';
import {
  Button,
  Input,
  Checkbox,
  Radio,
  RadioGroup,
  Switch,
  Select,
  Modal,
  Tabs,
  Table,
  MessageProvider,
  useMessage,
} from '@zui/react';

function MessageDemo() {
  const message = useMessage();
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button variant="secondary" onClick={() => message.success('保存成功')}>
        success
      </Button>
      <Button variant="secondary" onClick={() => message.error('出错了')}>
        error
      </Button>
      <Button variant="secondary" onClick={() => message.warning('注意磁盘空间')}>
        warning
      </Button>
      <Button variant="secondary" onClick={() => message.info('有 3 条新消息')}>
        info
      </Button>
    </div>
  );
}

function App() {
  const [dark, setDark] = React.useState(false);
  const [checked, setChecked] = React.useState(true);
  const [tab, setTab] = React.useState('a');

  React.useEffect(() => {
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
  }, [dark]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>ZUI 组件预览</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.65 }}>
            10 个核心组件 · 令牌驱动 · 零运行时 · 完整文档站开发中
          </p>
        </div>
        <Switch checked={dark} onChange={setDark} label="暗色" />
      </header>

      <section style={{ display: 'grid', gap: 28 }}>
        <Card title="Button">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button>primary</Button>
            <Button variant="secondary">secondary</Button>
            <Button variant="outline">outline</Button>
            <Button variant="ghost">ghost</Button>
            <Button variant="danger">danger</Button>
            <Button loading>loading</Button>
            <Button disabled>disabled</Button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <Button size="sm">sm</Button>
            <Button size="md">md</Button>
            <Button size="lg">lg</Button>
          </div>
        </Card>

        <Card title="Input">
          <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
            <Input placeholder="基础输入框" />
            <Input placeholder="带前后缀" prefix="🔍" suffix=".com" />
            <Input placeholder="可清除" clearable defaultValue="点右侧 × 清除" />
            <Input placeholder="错误状态" status="error" defaultValue="非法内容" />
          </div>
        </Card>

        <Card title="Checkbox / Radio / Switch">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Checkbox label="复选框" defaultChecked />
            <Checkbox label="半选" indeterminate />
            <Checkbox label="禁用" disabled />
            <RadioGroup defaultValue="b" name="demo" orientation="horizontal">
              <Radio value="a" label="选项 A" />
              <Radio value="b" label="选项 B" />
              <Radio value="c" label="选项 C（禁用）" disabled />
            </RadioGroup>
            <Switch checked={checked} onChange={setChecked} label="开关" />
          </div>
        </Card>

        <Card title="Select（支持完整键盘导航：↑↓ Home End Enter Esc）">
          <div style={{ maxWidth: 280 }}>
            <Select
              placeholder="请选择城市"
              options={[
                { value: 'bj', label: '北京' },
                { value: 'sh', label: '上海' },
                { value: 'gz', label: '广州' },
                { value: 'sz', label: '深圳' },
                { value: 'cd', label: '成都', disabled: true },
              ]}
            />
          </div>
        </Card>

        <Card title="Modal（焦点陷阱 + Esc 关闭 + 焦点归还）">
          <Modal>
            <Modal.Trigger>打开弹窗</Modal.Trigger>
            <Modal.Content size="md">
              <Modal.Header>
                <Modal.Title>确认操作</Modal.Title>
                <Modal.Description>这是 Modal.Description 描述文案。</Modal.Description>
              </Modal.Header>
              <Modal.Body>
                <Input placeholder="弹窗内可交互，Tab 不会逃出" data-autofocus />
              </Modal.Body>
              <Modal.Footer>
                <Modal.Close>取消</Modal.Close>
                <Button>确认</Button>
              </Modal.Footer>
            </Modal.Content>
          </Modal>
        </Card>

        <Card title="Tabs">
          <Tabs value={tab} onValueChange={setTab}>
            <Tabs.List>
              <Tabs.Trigger value="a">概览</Tabs.Trigger>
              <Tabs.Trigger value="b">配置</Tabs.Trigger>
              <Tabs.Trigger value="c" disabled>
                禁用
              </Tabs.Trigger>
              <Tabs.Trigger value="d">关于</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Panel value="a">概览面板（←→ 切换，Home/End 跳首尾）</Tabs.Panel>
            <Tabs.Panel value="b">配置面板</Tabs.Panel>
            <Tabs.Panel value="d">关于面板</Tabs.Panel>
          </Tabs>
        </Card>

        <Card title="Table">
          <Table density="comfortable" striped>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>姓名</Table.HeaderCell>
                <Table.HeaderCell>部门</Table.HeaderCell>
                <Table.HeaderCell align="right">工时</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              <Table.Row selected>
                <Table.Cell>张三</Table.Cell>
                <Table.Cell>研发</Table.Cell>
                <Table.Cell align="right">128</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>李四</Table.Cell>
                <Table.Cell>设计</Table.Cell>
                <Table.Cell align="right">96</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        </Card>

        <Card title="Message（hooks 型 API）">
          <MessageDemo />
        </Card>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="z-reset"
      style={{
        border: '1px solid var(--z-color-border)',
        borderRadius: 'var(--z-radius-lg)',
        padding: 20,
        background: 'var(--z-color-bg-elevated)',
      }}
    >
      <h2 style={{ margin: '0 0 14px', fontSize: 15, opacity: 0.75, fontWeight: 600 }}>{title}</h2>
      {children}
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MessageProvider>
      <div className="z-reset" style={{ minHeight: '100vh', background: 'var(--z-color-bg)' }}>
        <App />
      </div>
    </MessageProvider>
  </React.StrictMode>
);
