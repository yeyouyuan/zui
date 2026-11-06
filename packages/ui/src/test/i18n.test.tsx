import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ConfigProvider,
  zhCN,
  enUS,
  zhTW,
  jaJP,
  koKR,
  mergeLocale,
  Select,
  Empty,
  Popconfirm,
  Pagination,
  Button,
} from '../index';

afterEach(cleanup);

describe('i18n 语言包结构完整性', () => {
  const locales = [
    { name: 'zhCN', data: zhCN },
    { name: 'enUS', data: enUS },
    { name: 'zhTW', data: zhTW },
    { name: 'jaJP', data: jaJP },
    { name: 'koKR', data: koKR },
  ];

  const requiredSections = [
    'select',
    'input',
    'modal',
    'drawer',
    'message',
    'pagination',
    'empty',
    'date',
    'transfer',
    'timePicker',
    'popconfirm',
    'tour',
  ] as const;

  locales.forEach(({ name, data }) => {
    it(`语言包 ${name} 具备全部必需字段`, () => {
      requiredSections.forEach((sec) => {
        expect(data[sec], `缺少 section: ${sec}`).toBeDefined();
      });
      expect(data.date.weekdays).toHaveLength(7);
      expect(typeof data.select.placeholder).toBe('string');
      expect(typeof data.empty.description).toBe('string');
      expect(typeof data.popconfirm.ok).toBe('string');
      expect(typeof data.popconfirm.cancel).toBe('string');
      expect(typeof data.tour.prev).toBe('string');
      expect(typeof data.tour.next).toBe('string');
      expect(typeof data.tour.finish).toBe('string');
    });
  });

  it('mergeLocale 深合并能够局部覆盖特定文案', () => {
    const custom = mergeLocale(enUS, {
      select: { placeholder: 'Pick one' },
    });
    expect(custom.select.placeholder).toBe('Pick one');
    expect(custom.select.empty).toBe('No options'); // 保留原有未覆盖项
    expect(custom.popconfirm.ok).toBe('OK');
  });
});

describe('ConfigProvider 动态切换语言', () => {
  it('默认 zh-CN 文案展示', () => {
    const { container } = render(
      <ConfigProvider>
        <Select options={[]} />
        <Empty />
      </ConfigProvider>
    );
    expect(container.querySelector('[data-part="trigger"]')).toHaveTextContent('请选择');
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('切换到 enUS 显示英文', () => {
    const { container } = render(
      <ConfigProvider locale={enUS}>
        <Select options={[]} />
        <Empty />
        <Pagination total={50} defaultPage={1} />
      </ConfigProvider>
    );
    expect(container.querySelector('[data-part="trigger"]')).toHaveTextContent('Select...');
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('切换到 jaJP 显示日语', () => {
    const { container } = render(
      <ConfigProvider locale={jaJP}>
        <Select options={[]} />
        <Empty />
        <Pagination total={50} defaultPage={1} />
      </ConfigProvider>
    );
    expect(container.querySelector('[data-part="trigger"]')).toHaveTextContent('選択してください');
    expect(screen.getByText('データなし')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前へ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '次へ' })).toBeInTheDocument();
  });

  it('切换到 zhTW 显示繁体中文', () => {
    const { container } = render(
      <ConfigProvider locale={zhTW}>
        <Select options={[]} />
        <Empty />
      </ConfigProvider>
    );
    expect(container.querySelector('[data-part="trigger"]')).toHaveTextContent('請選擇');
    expect(screen.getByText('暫無資料')).toBeInTheDocument();
  });

  it('切换到 koKR 显示韩语', () => {
    const { container } = render(
      <ConfigProvider locale={koKR}>
        <Select options={[]} />
        <Empty />
      </ConfigProvider>
    );
    expect(container.querySelector('[data-part="trigger"]')).toHaveTextContent('선택하세요');
    expect(screen.getByText('데이터 없음')).toBeInTheDocument();
  });

  it('Popconfirm 按钮文案随 ConfigProvider 语言包自动切换', async () => {
    const user = userEvent.setup();
    render(
      <ConfigProvider locale={zhCN}>
        <Popconfirm title="删除确认">
          <Button>删除</Button>
        </Popconfirm>
      </ConfigProvider>
    );

    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByRole('button', { name: '确定' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();

    cleanup();

    render(
      <ConfigProvider locale={enUS}>
        <Popconfirm title="Delete Confirmation">
          <Button>Delete</Button>
        </Popconfirm>
      </ConfigProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
