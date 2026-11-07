import { Col, Flex, Row, Space } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const GRID_CODE = `<Row>
  <Col span={8}>8 / 24</Col>
  <Col span={8}>8 / 24</Col>
  <Col span={8}>8 / 24</Col>
</Row>
<Row>
  <Col span={6}>6 / 24</Col>
  <Col span={6} offset={6}>偏移 6 格</Col>
</Row>`;

const GUTTER_CODE = `<Row gutter={16}>
  <Col span={8}>水平间隔 16px</Col>
  <Col span={8}>水平间隔 16px</Col>
</Row>
<Row gutter={[16, 24]}>
  <Col span={12}>[水平 16, 垂直 24]</Col>
  <Col span={12}>[水平 16, 垂直 24]</Col>
</Row>`;

const FLEX_COL_CODE = `<Row>
  <Col span={6} flex="auto">flex=auto 占满剩余空间</Col>
  <Col span={6}>固定 6 / 24</Col>
</Row>`;

const FLEX_CODE = `<Flex gap="md">
  <Button>按钮一</Button>
  <Button>按钮二</Button>
</Flex>
<Flex vertical gap={8} justify="center" align="center">
  <span>纵向</span>
  <span>堆叠</span>
</Flex>`;

const SPACE_CODE = `<Space size="sm">小间距</Space>
<Space>默认间距（8px）</Space>
<Space size={24}>自定义 24px</Space>
<Space direction="vertical">纵向排列</Space>`;

const DEMO_BOX_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  background: 'var(--z-color-bg-subtle)',
  border: '1px solid var(--z-color-border-subtle)',
  borderRadius: 'var(--z-radius-sm)',
  padding: 'var(--z-space-2) var(--z-space-3)',
  textAlign: 'center',
  color: 'var(--z-color-fg-muted)',
};

const DEMO_ROW_STYLE: React.CSSProperties = { marginBottom: 'var(--z-space-2)' };

export default function LayoutPage(): React.ReactNode {
  usePageTitle('Layout 布局');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Layout 布局</h1>
      <p className="doc-lead">
        纯展示布局四件套：Row / Col 提供 24 栅格体系（gutter 经 React Context 注入，
        span/offset 用内联 CSS 变量 + calc，零工具类）；Flex 是万能弹性容器；
        Space 用 inline-flex + gap 提供统一间距。全部无 role、无状态。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础栅格"
        description="Row 内放置 Col，span 占 1-24 格（宽度 calc(span/24*100%)），offset 左侧偏移。"
        code={GRID_CODE}
        stack
      >
        <Row style={DEMO_ROW_STYLE}>
          <Col span={8}>
            <div style={DEMO_BOX_STYLE}>8 / 24</div>
          </Col>
          <Col span={8}>
            <div style={DEMO_BOX_STYLE}>8 / 24</div>
          </Col>
          <Col span={8}>
            <div style={DEMO_BOX_STYLE}>8 / 24</div>
          </Col>
        </Row>
        <Row>
          <Col span={6}>
            <div style={DEMO_BOX_STYLE}>6 / 24</div>
          </Col>
          <Col span={6} offset={6}>
            <div style={DEMO_BOX_STYLE}>偏移 6 格</div>
          </Col>
        </Row>
      </Demo>

      <Demo
        title="间隔 gutter"
        description="number 为水平间隔；[水平, 垂直] 分别控制。水平间隔由 Row 负 margin-inline 与 Col padding-inline 成对实现（经 Context 注入），垂直间隔走 row-gap。"
        code={GUTTER_CODE}
        stack
      >
        <Row gutter={16} style={DEMO_ROW_STYLE}>
          <Col span={8}>
            <div style={DEMO_BOX_STYLE}>水平 16</div>
          </Col>
          <Col span={8}>
            <div style={DEMO_BOX_STYLE}>水平 16</div>
          </Col>
          <Col span={8}>
            <div style={DEMO_BOX_STYLE}>水平 16</div>
          </Col>
        </Row>
        <Row gutter={[16, 24]}>
          <Col span={12}>
            <div style={DEMO_BOX_STYLE}>[水平 16, 垂直 24]</div>
          </Col>
          <Col span={12}>
            <div style={DEMO_BOX_STYLE}>[水平 16, 垂直 24]</div>
          </Col>
          <Col span={12}>
            <div style={DEMO_BOX_STYLE}>[水平 16, 垂直 24]</div>
          </Col>
          <Col span={12}>
            <div style={DEMO_BOX_STYLE}>[水平 16, 垂直 24]</div>
          </Col>
        </Row>
      </Demo>

      <Demo
        title="flex 弹性列"
        description="Col 提供 flex（flex-basis 语义）时覆盖 span，剩余空间自动分配。"
        code={FLEX_COL_CODE}
        stack
      >
        <Row>
          <Col span={6} flex="auto">
            <div style={DEMO_BOX_STYLE}>flex=auto 占满剩余</div>
          </Col>
          <Col span={6}>
            <div style={DEMO_BOX_STYLE}>固定 6 / 24</div>
          </Col>
        </Row>
      </Demo>

      <Demo
        title="Flex 弹性容器"
        description="vertical 换主轴方向；justify/align 控制主轴/交叉轴排列；gap 支持 sm/md/lg（映射 --z-space-2/3/4）、number（px）与任意字符串；component 可换语义标签。"
        code={FLEX_CODE}
        stack
      >
        <Flex gap="md" style={DEMO_ROW_STYLE}>
          <div style={DEMO_BOX_STYLE}>gap=md</div>
          <div style={DEMO_BOX_STYLE}>居中排列</div>
          <div style={DEMO_BOX_STYLE}>默认水平</div>
        </Flex>
        <Flex justify="space-between" align="center" style={DEMO_ROW_STYLE}>
          <div style={DEMO_BOX_STYLE}>space-between</div>
          <div style={DEMO_BOX_STYLE}>align=center</div>
        </Flex>
        <Flex vertical gap={8} style={DEMO_ROW_STYLE}>
          <div style={DEMO_BOX_STYLE}>纵向</div>
          <div style={DEMO_BOX_STYLE}>堆叠</div>
        </Flex>
        <Flex component="ul" vertical gap={4} style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          <li style={DEMO_BOX_STYLE}>语义列表项一</li>
          <li style={DEMO_BOX_STYLE}>语义列表项二</li>
        </Flex>
      </Demo>

      <Demo
        title="Space 间距容器"
        description="size 默认 md（8px）；sm/md/lg 取相邻间距令牌 --z-space-1/2/3，number 直接按 px。direction=vertical 纵向排列，wrap 允许换行。"
        code={SPACE_CODE}
        stack
      >
        <Space wrap style={DEMO_ROW_STYLE}>
          <div style={DEMO_BOX_STYLE}>size=sm（4px）</div>
          <div style={DEMO_BOX_STYLE}>size=md（8px）</div>
          <div style={DEMO_BOX_STYLE}>size=lg（12px）</div>
          <div style={DEMO_BOX_STYLE}>size=24</div>
        </Space>
        <Space direction="vertical">
          <div style={DEMO_BOX_STYLE}>纵向一</div>
          <div style={DEMO_BOX_STYLE}>纵向二</div>
        </Space>
      </Demo>

      <h2 className="doc-h2">API</h2>

      <h3 className="doc-h3">Row</h3>
      <ApiTable
        rows={[
          {
            name: 'gutter',
            type: 'number | [number, number]',
            defaultValue: '0',
            description:
              '栅格间隔；数组为 [水平, 垂直]。水平经 Row 负 margin-inline + Col padding-inline（Context 注入），垂直走 row-gap。',
          },
          {
            name: 'justify',
            type: "'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'",
            defaultValue: "'start'",
            description: '水平排列方式（data-justify）。',
          },
          {
            name: 'align',
            type: "'top' | 'middle' | 'bottom'",
            defaultValue: "'top'",
            description: '垂直对齐方式（data-align）。',
          },
          {
            name: 'wrap',
            type: 'boolean',
            defaultValue: 'true',
            description: '是否自动换行（data-wrap）。',
          },
          {
            name: 'classNames',
            type: '{ root? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到根元素（className、style、aria-*、事件等）。',
          },
        ]}
      />

      <h3 className="doc-h3">Col</h3>
      <ApiTable
        rows={[
          {
            name: 'span',
            type: 'number',
            defaultValue: '24',
            description:
              '占 1-24 格，宽度 calc(span/24*100%)；以内联 CSS 变量 --z-col-span + CSS calc 实现，不生成工具类。',
          },
          {
            name: 'offset',
            type: 'number',
            defaultValue: '0',
            description: '左侧偏移 0-23 格（margin-left，内联 --z-col-offset）。',
          },
          {
            name: 'flex',
            type: "string | number | 'auto' | 'none'",
            description: '弹性布局（flex-basis 语义），提供时覆盖 span。',
          },
          {
            name: 'classNames',
            type: '{ root? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到根元素。',
          },
        ]}
      />
      <p className="doc-p">
        Col 必须是 Row 直接子级；脱离 Row（无 Context）时水平间隔为 0，宽度回落{' '}
        <code className="doc-code-inline">100%</code>。
      </p>

      <h3 className="doc-h3">Flex</h3>
      <ApiTable
        rows={[
          {
            name: 'vertical',
            type: 'boolean',
            defaultValue: 'false',
            description: '主轴垂直（flex-direction: column）。',
          },
          {
            name: 'justify',
            type: "'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'",
            defaultValue: "'start'",
            description: '主轴排列方式（data-justify）。',
          },
          {
            name: 'align',
            type: "'start' | 'center' | 'end' | 'baseline' | 'stretch'",
            defaultValue: "'start'",
            description: '交叉轴对齐方式（data-align）。',
          },
          {
            name: 'gap',
            type: "'sm' | 'md' | 'lg' | number | string",
            defaultValue: '—',
            description:
              '间距：sm/md/lg 映射 --z-space-2/3/4；number → px；string 原样内联 gap。',
          },
          {
            name: 'wrap',
            type: 'boolean',
            defaultValue: 'false',
            description: '是否允许换行（data-wrap）。',
          },
          {
            name: 'flex',
            type: 'string | number',
            defaultValue: '—',
            description: 'flex 属性内联覆盖。',
          },
          {
            name: 'component',
            type: "'div' | 'span' | 'ul' | 'ol'",
            defaultValue: "'div'",
            description: '渲染的语义标签（需要列表语义时用 ul/ol 配合 li）。',
          },
          {
            name: 'classNames',
            type: '{ root? }',
            description: 'slot 级类名追加。',
          },
        ]}
      />

      <h3 className="doc-h3">Space</h3>
      <ApiTable
        rows={[
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg' | number",
            defaultValue: "'md'（8px）",
            description:
              '间距尺寸：sm/md/lg 取相邻令牌 --z-space-1/2/3，number 直接按 px。',
          },
          {
            name: 'direction',
            type: "'horizontal' | 'vertical'",
            defaultValue: "'horizontal'",
            description: '排列方向（data-direction）。',
          },
          {
            name: 'wrap',
            type: 'boolean',
            defaultValue: 'false',
            description: '是否允许换行（data-wrap）。',
          },
          {
            name: 'align',
            type: "'start' | 'center' | 'end' | 'baseline'",
            defaultValue: "'start'",
            description: '交叉轴对齐方式（data-align）。',
          },
          {
            name: 'classNames',
            type: '{ root? }',
            description: 'slot 级类名追加。',
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：Row <code className="doc-code-inline">data-justify</code> /{' '}
        <code className="doc-code-inline">data-align</code> /{' '}
        <code className="doc-code-inline">data-wrap</code>；Col{' '}
        <code className="doc-code-inline">data-flex</code>；Flex{' '}
        <code className="doc-code-inline">data-vertical</code> /{' '}
        <code className="doc-code-inline">data-justify</code> /{' '}
        <code className="doc-code-inline">data-align</code> /{' '}
        <code className="doc-code-inline">data-wrap</code>；Space{' '}
        <code className="doc-code-inline">data-direction</code> /{' '}
        <code className="doc-code-inline">data-align</code> /{' '}
        <code className="doc-code-inline">data-wrap</code>。Row/Col/Flex 无 role
        （纯布局 div），均以 <code className="doc-code-inline">data-part="root"</code>{' '}
        作为结构定制出口。
      </p>

      <CustomizeOutlet
        name="Row"
        parts={['root']}
        vars={['--z-row-gutter-x', '--z-row-gutter-y']}
      />
      <CustomizeOutlet
        name="Col"
        parts={['root']}
        vars={['--z-col-span', '--z-col-offset', '--z-col-gutter-x']}
      />
      <CustomizeOutlet name="Flex" parts={['root']} vars={['--z-flex-gap']} />
      <CustomizeOutlet name="Space" parts={['root']} vars={['--z-space-gap']} />
    </div>
  );
}
