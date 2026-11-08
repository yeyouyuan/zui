/**
 * a11y.axe.test.tsx —— axe-core 自动化扫描（契约：CONTRACTS-V5.md §4）
 *
 * 渲染代表性组件矩阵（Button 全变体、Input+label、Select 关闭态、Checkbox/Radio/Switch
 * 选中与禁用、Tabs、Table、Alert 四态、Empty、Card、Pagination、Badge），
 * 对每棵树跑 axe.run 并断言 violations = 0。发现真实违规应修组件而非豁免；
 * 确需豁免的规则按 id 显式禁用并在 docs/a11y-notes.md「axe 集成」小节写明原因。
 *
 * 与 a11y.roles / a11y.keyboard / a11y.labels 的分工：那三套断言我们「声明的语义」，
 * 本套用 axe-core 独立规则引擎反向验证「实际 DOM 是否有未声明的缺陷」。
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { Alert } from '../components/Alert';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Checkbox } from '../components/Checkbox';
import { Combobox } from '../components/Combobox';
import { CommandPalette } from '../components/CommandPalette';
import { MultiCombobox } from '../components/MultiCombobox';
import { SideNav } from '../components/SideNav';
import { Splitter } from '../components/Splitter';
import { Empty } from '../components/Empty';
import { Input } from '../components/Input';
import { Pagination } from '../components/Pagination';
import { Progress } from '../components/Progress';
import { Radio, RadioGroup } from '../components/Radio';
import { Select, type SelectOption } from '../components/Select';
import { Switch } from '../components/Switch';
import { Table } from '../components/Table';
import { Tabs } from '../components/Tabs';
import { Upload } from '../components/Upload';

/* ------------------------------ jsdom 环境补丁 ----------------------------- */

/**
 * jsdom 不实现 canvas（getContext 打印 "Not implemented" 噪音且返回 undefined），
 * 而 axe 的 icon-ligature 检测（visibleVirtual → _isIconLigature）需要一个可用的
 * 2d context 度量文本宽度。提供确定性 stub（两次度量同宽 → 判非图标连字），
 * 只影响本套件环境，产出与真实浏览器一致的「非连字」结论。
 */
const fakeCanvas2d = {
  canvas: { width: 0, height: 0 },
  font: '',
  measureText: () => ({ width: 10 }),
} as unknown as CanvasRenderingContext2D;
HTMLCanvasElement.prototype.getContext = (() =>
  fakeCanvas2d) as unknown as typeof HTMLCanvasElement.prototype.getContext;

/* ------------------------------ axe 运行配置 ------------------------------ */

/**
 * 禁用 color-contrast：jsdom 不做真实布局与绘制， axe 拿不到最终前景/背景色
 * （computed style 多为空或继承占位），该规则在 jsdom 下只会产出大量不可靠结果。
 * 真实对比度属于「必须人工实测」清单（docs/a11y-notes.md §4），在真实浏览器/E2E 阶段覆盖。
 */
const AXE_RUN_OPTIONS: axe.RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
  },
};

/* -------------------------------- 渲染脚手架 ------------------------------- */

/** 本用例创建的宿主容器，afterEach 统一移除（setup.ts 未注册自动 cleanup） */
const hosts: HTMLElement[] = [];

/**
 * 渲染进带 `z-reset` class 的容器（box-sizing 依赖，契约 §4 要求），
 * 内容包一层 `<main>`：axe 的 region 规则要求页面内容落在 landmark 内，
 * 测试宿主 div 不是语义容器，用 main 包裹使扫描树结构合法，避免无意义豁免。
 */
function renderForAxe(ui: React.ReactElement): HTMLElement {
  const host = document.createElement('div');
  host.className = 'z-reset';
  document.body.appendChild(host);
  hosts.push(host);
  render(<main>{ui}</main>, { container: host });
  return host;
}

afterEach(() => {
  cleanup();
  for (const host of hosts.splice(0)) host.remove();
});

/** 违规摘要（rule id + impact + 目标选择器），失败信息与断言共用 */
function summarize(results: axe.AxeResults): string {
  return results.violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ');
      return `${violation.id} (${violation.impact ?? 'unknown'}): ${targets}`;
    })
    .join('\n');
}

/** 扫描容器并断言 0 违规；失败时在错误信息里携带违规明细，便于定位修复 */
async function expectNoViolations(host: HTMLElement): Promise<void> {
  const results = await axe.run(host, AXE_RUN_OPTIONS);
  const summary = summarize(results);
  expect(summary, `axe 发现违规:\n${summary}`).toBe('');
}

/* --------------------------------- 夹具数据 -------------------------------- */

const fruitOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

/* ---------------------------------- 用例 ---------------------------------- */

describe('axe-core 组件矩阵扫描', () => {
  it('Button：全变体 + 尺寸 + loading + 纯图标按钮', async () => {
    const host = renderForAxe(
      <>
        <Button>主要按钮</Button>
        <Button variant="secondary">次要按钮</Button>
        <Button variant="outline">描边按钮</Button>
        <Button variant="ghost">幽灵按钮</Button>
        <Button variant="danger">危险按钮</Button>
        <Button size="sm">小按钮</Button>
        <Button size="lg">大按钮</Button>
        <Button loading>加载中按钮</Button>
        <Button disabled>禁用按钮</Button>
        {/* 纯图标按钮：可访问名由调用方提供 aria-label（a11y-notes §2 Button 行） */}
        <Button aria-label="新建条目" iconStart="+" />
      </>
    );
    await expectNoViolations(host);
  });

  it('Input：label 关联 + 可清除 + 状态', async () => {
    const host = renderForAxe(
      <>
        <label htmlFor="axe-input-name">用户名</label>
        <Input id="axe-input-name" clearable defaultValue="ZUI" />
        <label htmlFor="axe-input-empty">空输入</label>
        <Input id="axe-input-empty" status="error" />
      </>
    );
    await expectNoViolations(host);
  });

  it('Input 子组件：Textarea / Password / Search', async () => {
    const host = renderForAxe(
      <>
        <label htmlFor="axe-textarea-bio">简介</label>
        <Input.Textarea id="axe-textarea-bio" clearable defaultValue="介绍文案" />
        <Input.Password aria-label="密码" defaultValue="secret" />
        <Input.Search aria-label="搜索" defaultValue="关键词" clearable />
      </>
    );
    await expectNoViolations(host);
  });

  it('Select：关闭态（选中 / 占位 / 禁用）', async () => {
    const host = renderForAxe(
      <>
        <Select options={fruitOptions} defaultValue="apple" aria-label="水果选择" />
        <Select options={fruitOptions} aria-label="占位选择" />
        <Select options={fruitOptions} disabled aria-label="禁用选择" />
      </>
    );
    await expectNoViolations(host);
  });

  it('Combobox：关闭态（选中可清除 / 只读）', async () => {
    const host = renderForAxe(
      <>
        <label htmlFor="axe-combobox-fruit">水果搜索</label>
        <Combobox id="axe-combobox-fruit" options={fruitOptions} defaultValue="apple" clearable />
        <Combobox options={fruitOptions} defaultValue="banana" readOnly aria-label="只读水果" />
      </>
    );
    await expectNoViolations(host);
  });

  it('MultiCombobox：多选标签 + 异步 loading', async () => {
    const host = renderForAxe(
      <>
        <label htmlFor="axe-multicombobox-tags">水果标签</label>
        <MultiCombobox
          id="axe-multicombobox-tags"
          options={fruitOptions}
          defaultValue={['apple']}
          clearable
        />
        <MultiCombobox options={fruitOptions} loading aria-label="加载中的水果标签" />
      </>
    );
    await expectNoViolations(host);
  });

  it('SideNav：当前页 + 分组展开 + disabled 叶子', async () => {
    const host = renderForAxe(
      <SideNav
        sections={[
          {
            key: 'workspace',
            label: '工作区',
            items: [
              { key: 'overview', label: '概览', href: '#/overview', icon: <i>◎</i> },
              {
                key: 'settings',
                label: '设置',
                icon: <i>⚙</i>,
                children: [
                  { key: 'profile', label: '资料', href: '#/settings/profile' },
                  { key: 'billing', label: '计费', href: '#/settings/billing', disabled: true },
                ],
              },
            ],
          },
        ]}
        currentKey="profile"
        defaultExpandedKeys={['settings']}
        aria-label="主导航"
      />
    );
    await expectNoViolations(host);
  });

  it('Splitter：焦点在 separator 上', async () => {
    const host = renderForAxe(
      <Splitter aria-label="工作台" defaultSizes={[40, 60]}>
        <Splitter.Panel key="left">左</Splitter.Panel>
        <Splitter.Panel key="right">右</Splitter.Panel>
      </Splitter>
    );
    host.querySelector<HTMLElement>('[data-part="handle"]')?.focus();
    await expectNoViolations(host);
  });

  it('CommandPalette：零结果 listbox 与外置 live status', async () => {
    renderForAxe(<CommandPalette defaultOpen commands={[]} aria-label="全局命令" />);
    await waitFor(() => expect(screen.getByRole('dialog', { name: '全局命令' })).toBeVisible());
    const results = await axe.run(document.body, AXE_RUN_OPTIONS);
    const summary = summarize(results);
    expect(summary, `axe 发现违规:\n${summary}`).toBe('');
  });

  it('Progress / Upload：进度条均有描述具体任务的可访问名称', async () => {
    const host = renderForAxe(
      <>
        <Progress percent={60} aria-label="任务进度" />
        <Upload
          defaultFileList={[
            { uid: 'axe-upload', name: 'report.pdf', status: 'uploading', percent: 40 },
          ]}
        />
      </>
    );
    await expectNoViolations(host);
  });

  it('Checkbox：选中 / 未选中 / 禁用 / 半选', async () => {
    const host = renderForAxe(
      <>
        <Checkbox label="已勾选" defaultChecked />
        <Checkbox label="未勾选" />
        <Checkbox label="禁用选中" checked disabled />
        <Checkbox label="半选" indeterminate />
      </>
    );
    await expectNoViolations(host);
  });

  it('RadioGroup：选中 / 未选中 / 禁用项', async () => {
    const host = renderForAxe(
      <RadioGroup defaultValue="a" name="axe-plan" aria-label="套餐选择">
        <Radio value="a" label="方案 A" />
        <Radio value="b" label="方案 B" />
        <Radio value="c" label="方案 C" disabled />
      </RadioGroup>
    );
    await expectNoViolations(host);
  });

  it('Switch：选中 / 禁用 / 无文字（aria-label）', async () => {
    const host = renderForAxe(
      <>
        <Switch label="通知开关" defaultChecked />
        <Switch label="禁用开关" checked disabled />
        <Switch aria-label="无文字开关" />
      </>
    );
    await expectNoViolations(host);
  });

  it('Tabs：tablist/tab/tabpanel 关联（含 disabled tab）', async () => {
    const host = renderForAxe(
      <Tabs defaultValue="one">
        <Tabs.List aria-label="示例页签">
          <Tabs.Trigger value="one">页签一</Tabs.Trigger>
          <Tabs.Trigger value="two">页签二</Tabs.Trigger>
          <Tabs.Trigger value="three" disabled>
            页签三
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="one">内容一</Tabs.Panel>
        <Tabs.Panel value="two">内容二</Tabs.Panel>
        <Tabs.Panel value="three">内容三</Tabs.Panel>
      </Tabs>
    );
    await expectNoViolations(host);
  });

  it('Table：表头 scope + 行/单元格语义（含选中行）', async () => {
    const host = renderForAxe(
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>名称</Table.HeaderCell>
            <Table.HeaderCell align="center">状态</Table.HeaderCell>
            <Table.HeaderCell align="right">大小</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row selected>
            <Table.Cell>文件 A</Table.Cell>
            <Table.Cell>启用</Table.Cell>
            <Table.Cell>1 KB</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>文件 B</Table.Cell>
            <Table.Cell>停用</Table.Cell>
            <Table.Cell>2 KB</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
    await expectNoViolations(host);
  });

  it('Alert：四态（info/success/warning/error，含可关闭）', async () => {
    const host = renderForAxe(
      <>
        <Alert title="提示">这是 info 描述</Alert>
        <Alert type="success" title="成功">
          操作已完成
        </Alert>
        <Alert type="warning" title="警告">
          磁盘空间不足
        </Alert>
        <Alert type="error" title="错误" closable>
          网络请求失败
        </Alert>
      </>
    );
    await expectNoViolations(host);
  });

  it('Empty：默认插图 + 描述 + 操作按钮', async () => {
    const host = renderForAxe(
      <Empty description="暂无数据">
        <Button variant="secondary" size="sm">
          新建
        </Button>
      </Empty>
    );
    await expectNoViolations(host);
  });

  it('Card：标题 + extra + 正文 + 页脚', async () => {
    const host = renderForAxe(
      <Card
        title="卡片标题"
        extra={
          <Button variant="ghost" size="sm">
            更多
          </Button>
        }
        footer="页脚信息"
      >
        卡片正文内容
      </Card>
    );
    await expectNoViolations(host);
  });

  it('Pagination：省略号 + aria-current + 跳页输入', async () => {
    const host = renderForAxe(<Pagination total={500} defaultPage={7} showJumper />);
    await expectNoViolations(host);
  });

  it('Badge：独立数字 / 圆点 / 包裹按钮角标', async () => {
    const host = renderForAxe(
      <>
        <Badge count={5} />
        <Badge count={120} />
        <Badge dot color="primary" />
        <Badge count={12}>
          <Button variant="outline" size="sm">
            消息
          </Button>
        </Badge>
        <Badge count={0} showZero>
          <Button variant="outline" size="sm">
            通知
          </Button>
        </Badge>
      </>
    );
    await expectNoViolations(host);
  });
});
