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
  frFR,
  deDE,
  esES,
  ruRU,
  ptBR,
  mergeLocale,
  Select,
  Empty,
  Popconfirm,
  Pagination,
  Button,
  Splitter,
} from '../index';

afterEach(cleanup);

describe('i18n 语言包结构完整性', () => {
  const locales = [
    { name: 'zhCN', data: zhCN },
    { name: 'enUS', data: enUS },
    { name: 'zhTW', data: zhTW },
    { name: 'jaJP', data: jaJP },
    { name: 'koKR', data: koKR },
    { name: 'frFR', data: frFR },
    { name: 'deDE', data: deDE },
    { name: 'esES', data: esES },
    { name: 'ruRU', data: ruRU },
    { name: 'ptBR', data: ptBR },
  ];

  const requiredSections = [
    'select',
    'sideNav',
    'splitter',
    'commandPalette',
    'statistic',
    'combobox',
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
      expect(Object.values(data.combobox).every((value) => typeof value === 'string')).toBe(true);
      expect(data.combobox.results).toContain('{count}');
      expect(Object.values(data.commandPalette).every((value) => typeof value === 'string')).toBe(
        true
      );
      expect(data.commandPalette.results).toContain('{count}');
      expect(data.splitter.panelLabel).toContain('{index}');
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
      combobox: { placeholder: 'Find a city' },
      commandPalette: { search: 'Find a command' },
    });
    expect(custom.select.placeholder).toBe('Pick one');
    expect(custom.select.empty).toBe('No options'); // 保留原有未覆盖项
    expect(custom.combobox.placeholder).toBe('Find a city');
    expect(custom.combobox.clear).toBe('Clear selection');
    expect(custom.commandPalette.search).toBe('Find a command');
    expect(custom.commandPalette.loading).toBe('Loading commands');
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
        <Splitter aria-label="Workspace">
          <Splitter.Panel key="left">Left</Splitter.Panel>
          <Splitter.Panel key="right">Right</Splitter.Panel>
        </Splitter>
      </ConfigProvider>
    );
    expect(container.querySelector('[data-part="trigger"]')).toHaveTextContent('Select...');
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(
      screen.getByRole('separator', { name: 'Resize panel: Panel 1 / Panel 2' })
    ).toBeInTheDocument();
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

describe('i18n 扩展语言包（frFR/deDE/esES/ruRU/ptBR）结构完整性', () => {
  const extendedLocales = [
    {
      name: 'frFR',
      data: frFR,
      placeholder: 'Sélectionner...',
      empty: 'Aucune donnée',
      prev: 'Précédent',
      next: 'Suivant',
    },
    {
      name: 'deDE',
      data: deDE,
      placeholder: 'Auswählen...',
      empty: 'Keine Daten',
      prev: 'Zurück',
      next: 'Weiter',
    },
    {
      name: 'esES',
      data: esES,
      placeholder: 'Seleccionar...',
      empty: 'Sin datos',
      prev: 'Anterior',
      next: 'Siguiente',
    },
    {
      name: 'ruRU',
      data: ruRU,
      placeholder: 'Выберите...',
      empty: 'Нет данных',
      prev: 'Назад',
      next: 'Вперёд',
    },
    {
      name: 'ptBR',
      data: ptBR,
      placeholder: 'Selecione...',
      empty: 'Sem dados',
      prev: 'Anterior',
      next: 'Próximo',
    },
  ];

  /** 递归收集对象键路径（数组视为叶子） */
  function collectKeyPaths(obj: unknown, prefix = ''): string[] {
    if (obj === null || typeof obj !== 'object') return [prefix];
    return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
      collectKeyPaths(value, prefix ? `${prefix}.${key}` : key)
    );
  }

  const zhCNKeyPaths = collectKeyPaths(zhCN);

  extendedLocales.forEach(({ name, data, placeholder, empty, prev, next }) => {
    it(`语言包 ${name} 与 zhCN 字段结构完全同构`, () => {
      const keyPaths = collectKeyPaths(data);
      expect(keyPaths.sort()).toEqual([...zhCNKeyPaths].sort());
    });

    it(`语言包 ${name} 各关键段字段均为字符串且 weekdays 为 7 项`, () => {
      expect(data.date.weekdays).toHaveLength(7);
      expect(data.date.weekdays.every((w) => typeof w === 'string' && w.length > 0)).toBe(true);
      expect(typeof data.select.placeholder).toBe('string');
      expect(Object.values(data.combobox).every((value) => typeof value === 'string')).toBe(true);
      expect(data.combobox.results).toContain('{count}');
      expect(typeof data.input.clear).toBe('string');
      expect(typeof data.modal.close).toBe('string');
      expect(typeof data.drawer.close).toBe('string');
      expect(typeof data.message.close).toBe('string');
      expect(typeof data.pagination.prev).toBe('string');
      expect(typeof data.pagination.next).toBe('string');
      expect(typeof data.empty.description).toBe('string');
      expect(typeof data.transfer.itemUnit).toBe('string');
      expect(typeof data.timePicker.placeholder).toBe('string');
      expect(typeof data.popconfirm.ok).toBe('string');
      expect(typeof data.app.confirm).toBe('string');
      expect(typeof data.tour.finish).toBe('string');
      expect(typeof data.upload.text).toBe('string');
      expect(typeof data.steps.label).toBe('string');
      expect(typeof data.dateRange.startPlaceholder).toBe('string');
      expect(Object.keys(data.accessibility)).toHaveLength(Object.keys(zhCN.accessibility).length);
      expect(Object.keys(data.form)).toHaveLength(Object.keys(zhCN.form).length);
      expect(Object.keys(data.result)).toHaveLength(Object.keys(zhCN.result).length);
      // monthFormat 仅允许 {year}/{month} 占位符（各语言仅调整顺序与分隔符）
      expect(data.date.monthFormat).toContain('{year}');
      expect(data.date.monthFormat).toContain('{month}');
    });

    it(`ConfigProvider 切换到 ${name} 后组件文案生效`, () => {
      const { container } = render(
        <ConfigProvider locale={data}>
          <Select options={[]} />
          <Empty />
          <Pagination total={50} defaultPage={1} />
        </ConfigProvider>
      );
      expect(container.querySelector('[data-part="trigger"]')).toHaveTextContent(placeholder);
      expect(screen.getByText(empty)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: prev })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: next })).toBeInTheDocument();
    });
  });
});
