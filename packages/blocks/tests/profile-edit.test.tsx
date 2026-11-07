import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileEditBlock, DEMO_PROFILE, DEMO_TENURE } from '../src/profile-edit';

afterEach(cleanup);

describe('profile-edit block', () => {
  it('renders the grid form with labeled fields, tenure range and avatar upload', () => {
    const { container } = render(
      <ProfileEditBlock values={DEMO_PROFILE} tenure={DEMO_TENURE} />
    );
    // 栅格布局
    expect(container.querySelector('.z-row')).toBeInTheDocument();
    expect(container.querySelector('.z-col')).toBeInTheDocument();
    // 表单字段与 label 关联
    expect(screen.getByLabelText('姓名')).toHaveValue('林小满');
    expect(screen.getByLabelText('昵称')).toHaveValue('小满');
    expect(screen.getByLabelText('邮箱')).toHaveValue('xiaoman.lin@example.com');
    expect(screen.getByLabelText('个人简介')).toHaveValue('负责 ZUI 组件库与设计系统工程化建设。');
    // 任职时间 + 头像上传
    expect(screen.getByText('任职时间')).toBeInTheDocument();
    expect(container.querySelector('.z-daterange')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '点击上传' })).toBeInTheDocument();
    expect(container.querySelector('.z-avatar')).toBeInTheDocument();
  });

  it('reports field edits through onChange', async () => {
    const onChange = vi.fn();
    render(<ProfileEditBlock values={DEMO_PROFILE} onChange={onChange} />);
    // 受控 Input 用 fireEvent 整体赋值，避免逐键回退干扰
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '满满' } });
    expect(onChange).toHaveBeenLastCalledWith({ nickname: '满满' });
    fireEvent.change(screen.getByLabelText('岗位'), { target: { value: '高级前端工程师' } });
    expect(onChange).toHaveBeenLastCalledWith({ position: '高级前端工程师' });
  });

  it('uploads an avatar file through the Upload control', async () => {
    const onAvatarFilesChange = vi.fn();
    const { container } = render(
      <ProfileEditBlock values={DEMO_PROFILE} onAvatarFilesChange={onAvatarFilesChange} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    const file = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    // selectFiles 是异步流转，等 onChange 与文件列表出现
    await waitFor(() => expect(onAvatarFilesChange).toHaveBeenCalled());
    const info = onAvatarFilesChange.mock.calls[0][0];
    expect(info.file.name).toBe('avatar.png');
    await waitFor(() => expect(screen.getByText('avatar.png')).toBeInTheDocument());
  });

  it('fires save with the current values', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<ProfileEditBlock values={DEMO_PROFILE} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: '保存资料' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(DEMO_PROFILE);
  });
});
