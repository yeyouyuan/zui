import { Avatar } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const FALLBACK_CODE = `<Avatar src="https://i.pravatar.cc/80?img=12" alt="头像" name="张三" />
<Avatar name="张三" />
<Avatar name="alice wang" />
<Avatar icon={<span>★</span>} />`;

const SIZE_CODE = `<Avatar size="sm" name="小" />
<Avatar size="md" name="中" />
<Avatar size="lg" name="大" />
<Avatar size={48} name="自" />`;

const SHAPE_CODE = `<Avatar shape="circle" name="圆" />
<Avatar shape="square" name="方" />
<Avatar shape="square" size={40} icon={<span>◎</span>} />`;

const COLOR_CODE = `<Avatar name="张三" />
<Avatar name="李四" />
<Avatar name="王五" />
<Avatar name="赵六" />
<Avatar name="孙七" />`;

export default function AvatarPage(): React.ReactNode {
  usePageTitle('Avatar 头像');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Avatar 头像</h1>
      <p className="doc-lead">
        用户或实体的视觉标识：图片 / 名字首字 / 图标三级回退，名字哈希在 5 组语义浅色中取底色，
        支持 3 档尺寸与任意像素自定义。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="三级回退"
        description="优先展示图片；无图或加载失败时回退名字首字（中文取第一个字，英文取首字母大写）；无名时回退图标。"
        code={FALLBACK_CODE}
      >
        <Avatar src="https://i.pravatar.cc/80?img=12" alt="头像" name="张三" />
        <Avatar name="张三" />
        <Avatar name="alice wang" />
        <Avatar icon={<span aria-hidden="true">★</span>} />
      </Demo>

      <Demo
        title="名字哈希配色"
        description="无图时按名字哈希在 primary / success / warning / info / danger 的 subtle 浅底中稳定取色，同名同色。"
        code={COLOR_CODE}
      >
        <Avatar name="张三" />
        <Avatar name="李四" />
        <Avatar name="王五" />
        <Avatar name="赵六" />
        <Avatar name="孙七" />
      </Demo>

      <Demo
        title="尺寸"
        description="size 提供 sm（24px）/ md（32px）/ lg（40px）三档，或传 number 自定义像素。"
        code={SIZE_CODE}
      >
        <Avatar size="sm" name="小" />
        <Avatar size="md" name="中" />
        <Avatar size="lg" name="大" />
        <Avatar size={48} name="自" />
      </Demo>

      <Demo
        title="形状"
        description="shape 提供 circle（默认）/ square 两种形状。"
        code={SHAPE_CODE}
      >
        <Avatar shape="circle" name="圆" />
        <Avatar shape="square" name="方" />
        <Avatar shape="square" size={40} icon={<span aria-hidden="true">◎</span>} />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'src',
            type: 'string',
            description: '图片地址；加载失败自动回退到名字首字 / 图标。',
          },
          {
            name: 'alt',
            type: 'string',
            description: '图片替代文本，缺省用 name。',
          },
          {
            name: 'name',
            type: 'string',
            description: '名字：无图时取首字符（中文取第一个字，英文取首字母大写），并按哈希取 5 色浅底。',
          },
          {
            name: 'icon',
            type: 'React.ReactNode',
            description: '无图无名时的图标。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg' | number",
            defaultValue: "'md'",
            description: '尺寸：sm 24px / md 32px / lg 40px；number 自定义像素。',
          },
          {
            name: 'shape',
            type: "'circle' | 'square'",
            defaultValue: "'circle'",
            description: '形状。',
          },
          {
            name: 'onError',
            type: 'React.ReactEventHandler<HTMLImageElement>',
            description: '图片加载失败回调（作用于 img，触发后组件回退）。',
          },
          {
            name: 'classNames',
            type: '{ root?; image?; fallback? }',
            description: 'slot 级类名追加（root / image / fallback）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'span'>",
            description: '原生 span 属性透传到根元素（className、style、aria-*、事件等；color 除外）。',
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-size</code>（number 尺寸为{' '}
        <code className="doc-code-inline">custom</code>，实际像素经内联{' '}
        <code className="doc-code-inline">--z-avatar-size</code> 注入）、
        <code className="doc-code-inline">data-shape</code>、
        <code className="doc-code-inline">data-color</code>（名字哈希色）。
      </p>

      <CustomizeOutlet
        name="Avatar"
        parts={['root', 'image', 'fallback']}
        vars={[
          '--z-avatar-size',
          '--z-avatar-radius',
          '--z-avatar-bg',
          '--z-avatar-fg',
          '--z-avatar-font-size',
          '--z-avatar-font-weight',
          '--z-avatar-font-family',
          '--z-avatar-icon-size',
          '--z-avatar-border',
        ]}
      />
    </div>
  );
}
