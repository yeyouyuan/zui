import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardBlock, DEMO_WIZARD_VALUES } from '../src/wizard';

afterEach(cleanup);

const baseValues = { ...DEMO_WIZARD_VALUES };

function fill(props: Partial<React.ComponentProps<typeof WizardBlock>> = {}) {
  return <WizardBlock values={baseValues} {...props} />;
}

afterEach(() => {
  baseValues.name = '';
  baseValues.code = '';
  baseValues.category = '';
  baseValues.owner = '';
});

describe('wizard block', () => {
  it('renders the three steps and the first step form', () => {
    const onCurrentChange = vi.fn();
    render(fill({ onCurrentChange }));
    expect(screen.getByRole('navigation', { name: '步骤条' })).toBeInTheDocument();
    expect(screen.getByText('基本信息')).toBeInTheDocument();
    expect(screen.getByText('项目配置')).toBeInTheDocument();
    expect(screen.getByText('确认创建')).toBeInTheDocument();
    expect(screen.getByLabelText('项目名称')).toBeInTheDocument();
    expect(screen.getByLabelText('项目编号')).toBeInTheDocument();
    // 第二步表单未渲染
    expect(screen.queryByLabelText('负责人')).not.toBeInTheDocument();
  });

  it('blocks going next with empty required fields and shows errors', async () => {
    const user = userEvent.setup();
    render(fill());
    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('请输入项目名称')).toBeInTheDocument();
    expect(screen.getByText('请输入项目编号')).toBeInTheDocument();
    // 仍停留在第一步
    expect(screen.getByLabelText('项目名称')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '上一步' })).not.toBeInTheDocument();
  });

  it('walks through all three steps and finishes with aggregated values', async () => {
    const values = { ...DEMO_WIZARD_VALUES };
    const onValuesChange = vi.fn((patch: Partial<typeof values>) => {
      Object.assign(values, patch);
    });
    const onFinish = vi.fn();
    const onCurrentChange = vi.fn();
    const user = userEvent.setup();
    const props = { values, onValuesChange, onFinish, onCurrentChange };

    const { rerender } = render(<WizardBlock {...props} />);

    // 第一步（受控 Input 用 fireEvent 整体赋值，避免逐键回退）
    fireEvent.change(screen.getByLabelText('项目名称'), { target: { value: 'ZUI 组件库' } });
    fireEvent.change(screen.getByLabelText('项目编号'), { target: { value: 'prj-001' } });
    rerender(<WizardBlock {...props} />);
    expect(screen.getByLabelText('项目名称')).toHaveValue('ZUI 组件库');
    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(onCurrentChange).toHaveBeenLastCalledWith(1);

    // 第二步：下拉 + 输入
    await user.click(screen.getByRole('button', { name: /^项目类别 / }));
    await user.click(screen.getByRole('option', { name: '平台组件' }));
    fireEvent.change(screen.getByLabelText('负责人'), { target: { value: '林小满' } });
    rerender(<WizardBlock {...props} />);
    expect(screen.getByRole('button', { name: '项目类别 平台组件' })).toHaveTextContent('平台组件');
    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(onCurrentChange).toHaveBeenLastCalledWith(2);

    // 第三步：确认信息 + 完成
    expect(screen.getByText('确认项目信息')).toBeInTheDocument();
    expect(screen.getByText('ZUI 组件库')).toBeInTheDocument();
    expect(screen.getByText('平台组件')).toBeInTheDocument();
    expect(screen.getByText('林小满')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '完成创建' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ZUI 组件库', code: 'prj-001', category: 'platform', owner: '林小满' })
    );
  });

  it('goes back to the previous step with 上一步', async () => {
    const user = userEvent.setup();
    const values = { ...DEMO_WIZARD_VALUES, name: 'ZUI 组件库', code: 'prj-001' };
    render(<WizardBlock values={values} defaultCurrent={1} />);
    expect(screen.getByLabelText('负责人')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '上一步' }));
    expect(screen.getByLabelText('项目名称')).toBeInTheDocument();
  });
});
