'use client';

import * as React from 'react';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { ColorPicker } from '../ColorPicker';
import { Input } from '../Input';
import { Modal } from '../Modal';
import { Select } from '../Select';
import type {
  StudioSheet,
  StudioSheetComparisonOperator,
  StudioSheetConditionalFormat,
  StudioSheetConditionalStyle,
  StudioSheetDataValidation,
} from './studio-types';

export type SheetRuleDialogMode = {
  kind: 'conditional' | 'validation' | 'series';
  ruleId?: string;
};

interface RuleDialogProps {
  mode: SheetRuleDialogMode;
  sheet: StudioSheet;
  range: string;
  blocked: boolean;
  onClose(): void;
  onEdit(mode: SheetRuleDialogMode): void;
  onConditional(rule: StudioSheetConditionalFormat): void;
  onValidation(rule: StudioSheetDataValidation): void;
  onRemove(kind: 'conditional' | 'validation', id: string): void;
  onSeries(options: {
    direction: 'down' | 'right';
    type: 'number' | 'date' | 'text';
    step?: number;
    seedCount: 1 | 2;
  }): void;
}

const conditions = [
  { value: 'cellIs', label: '数值比较' },
  { value: 'containsText', label: '文字包含' },
  { value: 'duplicateValues', label: '重复值' },
  { value: 'uniqueValues', label: '唯一值' },
  { value: 'top10', label: '前 / 后若干项' },
  { value: 'aboveAverage', label: '高于 / 低于平均值' },
  { value: 'colorScale', label: '色阶' },
  { value: 'expression', label: '使用公式' },
] as const;
const validationTypes = [
  { value: 'list', label: '列表' },
  { value: 'whole', label: '整数' },
  { value: 'decimal', label: '小数' },
  { value: 'date', label: '日期' },
  { value: 'time', label: '时间' },
  { value: 'textLength', label: '文本长度' },
  { value: 'custom', label: '自定义公式' },
] as const;
const comparisons: { value: StudioSheetComparisonOperator; label: string }[] = [
  { value: 'between', label: '介于' },
  { value: 'notBetween', label: '不介于' },
  { value: 'equal', label: '等于' },
  { value: 'notEqual', label: '不等于' },
  { value: 'greaterThan', label: '大于' },
  { value: 'greaterThanOrEqual', label: '大于或等于' },
  { value: 'lessThan', label: '小于' },
  { value: 'lessThanOrEqual', label: '小于或等于' },
];

function operand(input: string, type: string): string {
  const value = input.trim();
  if (type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) {
      const days = (date.getTime() - Date.UTC(1899, 11, 31)) / 86400000;
      return String(days + (value >= '1900-03-01' ? 1 : 0));
    }
    throw new Error('日期格式无效，请输入有效的 yyyy-mm-dd 日期。');
  }
  if (type === 'time' && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)) {
    const [hours, minutes, seconds = 0] = value.split(':').map(Number);
    if (hours < 24 && minutes < 60 && seconds < 60)
      return String((hours * 3600 + minutes * 60 + seconds) / 86400);
    throw new Error('时间格式无效，请输入 00:00 到 23:59:59 之间的时间。');
  }
  return value;
}

function ruleLabel(rule: StudioSheetConditionalFormat | StudioSheetDataValidation) {
  return (
    conditions.find((option) => option.value === rule.type)?.label ??
    validationTypes.find((option) => option.value === rule.type)?.label ??
    rule.type
  );
}

export function StudioSheetRuleDialog({
  mode,
  sheet,
  range: selectionRange,
  blocked,
  onClose,
  onEdit,
  onConditional,
  onValidation,
  onRemove,
  onSeries,
}: RuleDialogProps) {
  const formId = React.useId();
  const condition = sheet.conditionalFormats?.find((rule) => rule.id === mode.ruleId);
  const validation = sheet.dataValidations?.find((rule) => rule.id === mode.ruleId);
  const existing = mode.kind === 'conditional' ? condition : validation;
  const [range, setRange] = React.useState(existing?.range ?? selectionRange);
  const [conditionType, setConditionType] = React.useState<StudioSheetConditionalFormat['type']>(
    condition?.type ?? 'cellIs'
  );
  const [validationType, setValidationType] = React.useState<StudioSheetDataValidation['type']>(
    validation?.type ?? 'list'
  );
  const [operator, setOperator] = React.useState<StudioSheetComparisonOperator>(
    condition?.type === 'cellIs'
      ? condition.operator
      : validation && 'operator' in validation
        ? validation.operator
        : mode.kind === 'conditional'
          ? 'greaterThan'
          : 'between'
  );
  const [first, setFirst] = React.useState(
    condition?.type === 'cellIs'
      ? condition.formulae[0]
      : validation && 'formula1' in validation
        ? validation.formula1
        : '0'
  );
  const [second, setSecond] = React.useState(
    condition?.type === 'cellIs'
      ? (condition.formulae[1] ?? '100')
      : validation && 'formula2' in validation
        ? (validation.formula2 ?? '100')
        : '100'
  );
  const [formula, setFormula] = React.useState(
    condition?.type === 'expression'
      ? condition.formula
      : validation?.type === 'custom'
        ? validation.formula
        : `=${selectionRange.split(':')[0]}>0`
  );
  const [text, setText] = React.useState(condition?.type === 'containsText' ? condition.text : '');
  const [rank, setRank] = React.useState(String(condition?.type === 'top10' ? condition.rank : 10));
  const [percent, setPercent] = React.useState(condition?.type === 'top10' && !!condition.percent);
  const [bottom, setBottom] = React.useState(condition?.type === 'top10' && !!condition.bottom);
  const [above, setAbove] = React.useState(
    condition?.type !== 'aboveAverage' || condition.aboveAverage !== false
  );
  const [scaleCount, setScaleCount] = React.useState(
    condition?.type === 'colorScale' && condition.colors.length === 2 ? '2' : '3'
  );
  const [colors, setColors] = React.useState<string[]>(
    condition?.type === 'colorScale'
      ? condition.colors.length === 2
        ? [condition.colors[0], '#FDE68A', condition.colors[1]]
        : [...condition.colors]
      : ['#F87171', '#FDE68A', '#4ADE80']
  );
  const [style, setStyle] = React.useState<StudioSheetConditionalStyle>(
    condition ? (condition.style ?? {}) : { background: '#FEF3C7' }
  );
  const [priority, setPriority] = React.useState(
    String(
      condition?.priority ??
        Math.max(0, ...(sheet.conditionalFormats ?? []).map((rule) => rule.priority)) + 1
    )
  );
  const [stop, setStop] = React.useState(condition?.stopIfTrue ?? false);
  const [listMode, setListMode] = React.useState(
    validation?.type === 'list' && validation.source !== undefined ? 'source' : 'values'
  );
  const [listValues, setListValues] = React.useState(
    validation?.type === 'list' ? (validation.values ?? []).join(',') : '草稿,进行中,完成'
  );
  const [listSource, setListSource] = React.useState(
    validation?.type === 'list' ? (validation.source ?? '=$A$1:$A$3') : '=$A$1:$A$3'
  );
  const [allowBlank, setAllowBlank] = React.useState(validation?.allowBlank ?? true);
  const [showInput, setShowInput] = React.useState(validation?.showInputMessage ?? true);
  const [inputTitle, setInputTitle] = React.useState(validation?.inputTitle ?? '');
  const [inputMessage, setInputMessage] = React.useState(validation?.inputMessage ?? '');
  const [showError, setShowError] = React.useState(validation?.showErrorMessage ?? true);
  const [severity, setSeverity] = React.useState(validation?.errorStyle ?? 'stop');
  const [errorTitle, setErrorTitle] = React.useState(validation?.errorTitle ?? '输入无效');
  const [errorMessage, setErrorMessage] = React.useState(
    validation?.errorMessage ?? '请输入符合验证条件的值。'
  );
  const [direction, setDirection] = React.useState<'down' | 'right'>('down');
  const [seriesType, setSeriesType] = React.useState<'number' | 'date' | 'text'>('number');
  const [seeds, setSeeds] = React.useState<'1' | '2'>('1');
  const [step, setStep] = React.useState('');
  const [error, setError] = React.useState('');
  const between = operator === 'between' || operator === 'notBetween';
  const title =
    mode.kind === 'conditional' ? '条件格式' : mode.kind === 'validation' ? '数据验证' : '序列填充';

  function apply() {
    if (blocked) return;
    try {
      const id =
        mode.ruleId ??
        globalThis.crypto?.randomUUID?.() ??
        `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (mode.kind === 'series') {
        if (step.trim() && !Number.isFinite(Number(step))) throw new Error('步长必须是有效数字。');
        onSeries({
          direction,
          type: seriesType,
          seedCount: seeds === '2' ? 2 : 1,
          ...(step.trim() ? { step: Number(step) } : {}),
        });
      } else if (mode.kind === 'conditional') {
        const base = { id, range: range.trim(), priority: Number(priority), stopIfTrue: stop };
        const styled = { ...base, style };
        switch (conditionType) {
          case 'cellIs':
            onConditional({
              ...styled,
              type: 'cellIs',
              operator,
              formulae: between ? [first.trim(), second.trim()] : [first.trim()],
            });
            break;
          case 'expression':
            onConditional({ ...styled, type: 'expression', formula: formula.trim() });
            break;
          case 'containsText':
            onConditional({ ...styled, type: 'containsText', text });
            break;
          case 'top10':
            onConditional({ ...styled, type: 'top10', rank: Number(rank), percent, bottom });
            break;
          case 'aboveAverage':
            onConditional({ ...styled, type: 'aboveAverage', aboveAverage: above });
            break;
          case 'colorScale':
            onConditional({
              ...base,
              type: 'colorScale',
              colors:
                scaleCount === '2' ? [colors[0], colors[2]] : [colors[0], colors[1], colors[2]],
            });
            break;
          default:
            onConditional({ ...styled, type: conditionType });
        }
      } else {
        const base = {
          id,
          range: range.trim(),
          allowBlank,
          showInputMessage: showInput,
          inputTitle,
          inputMessage,
          showErrorMessage: showError,
          errorStyle: severity,
          errorTitle,
          errorMessage,
        };
        if (validationType === 'list') {
          onValidation({
            ...base,
            type: 'list',
            ...(listMode === 'source'
              ? { source: listSource.trim() }
              : { values: listValues.split(',').map((item) => item.trim()) }),
          });
        } else if (validationType === 'custom') {
          onValidation({ ...base, type: 'custom', formula: formula.trim() });
        } else {
          onValidation({
            ...base,
            type: validationType,
            operator,
            formula1: operand(first, validationType),
            ...(between ? { formula2: operand(second, validationType) } : {}),
          });
        }
      }
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '无法应用，请检查规则。');
    }
  }

  function remove(kind: 'conditional' | 'validation', id: string) {
    if (blocked) return;
    try {
      onRemove(kind, id);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '无法删除该规则。');
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Content size="lg" className="z-studio-sheet-rule-dialog">
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
          <Modal.Description>
            {mode.kind === 'series'
              ? '从选区的首行或首列推演序列，填充其余单元格。'
              : `${sheet.name} · ${existing ? '编辑现有规则' : '为选区创建规则'}`}
          </Modal.Description>
        </Modal.Header>
        <Modal.Body>
          <form
            id={formId}
            className="z-studio-sheet-rule-form"
            onSubmit={(event) => {
              event.preventDefault();
              apply();
            }}
          >
            {mode.kind !== 'series' && (
              <label className="z-studio-sheet-rule-field">
                <span>应用范围</span>
                <Input
                  aria-label="规则应用范围"
                  data-autofocus
                  value={range}
                  disabled={blocked}
                  onChange={(event) => setRange(event.target.value)}
                  placeholder="例如 A1:D10"
                />
              </label>
            )}
            {mode.kind === 'conditional' && (
              <>
                <label className="z-studio-sheet-rule-field">
                  <span>规则类型</span>
                  <Select
                    aria-label="条件格式类型"
                    value={conditionType}
                    options={[...conditions]}
                    disabled={blocked}
                    onChange={(value) => {
                      const found = conditions.find((option) => option.value === value);
                      if (found) setConditionType(found.value);
                    }}
                  />
                </label>
                {conditionType === 'containsText' && (
                  <label className="z-studio-sheet-rule-field">
                    <span>包含文字</span>
                    <Input
                      aria-label="条件文字"
                      value={text}
                      disabled={blocked}
                      maxLength={255}
                      onChange={(event) => setText(event.target.value)}
                    />
                  </label>
                )}
                {conditionType === 'top10' && (
                  <div className="z-studio-sheet-rule-row">
                    <label className="z-studio-sheet-rule-field">
                      <span>数量或百分比</span>
                      <Input
                        type="number"
                        min={1}
                        max={percent ? 100 : 1000}
                        aria-label="排名数量"
                        value={rank}
                        disabled={blocked}
                        onChange={(event) => setRank(event.target.value)}
                      />
                    </label>
                    <Checkbox
                      label="按百分比"
                      checked={percent}
                      disabled={blocked}
                      onChange={setPercent}
                    />
                    <Checkbox
                      label="取后若干项"
                      checked={bottom}
                      disabled={blocked}
                      onChange={setBottom}
                    />
                  </div>
                )}
                {conditionType === 'aboveAverage' && (
                  <Select
                    aria-label="平均值条件"
                    value={above ? 'above' : 'below'}
                    options={[
                      { value: 'above', label: '高于平均值' },
                      { value: 'below', label: '低于平均值' },
                    ]}
                    disabled={blocked}
                    onChange={(value) => setAbove(value === 'above')}
                  />
                )}
                {conditionType === 'colorScale' && (
                  <div className="z-studio-sheet-rule-row">
                    <Select
                      aria-label="色阶数量"
                      value={scaleCount}
                      options={[
                        { value: '2', label: '双色阶' },
                        { value: '3', label: '三色阶' },
                      ]}
                      disabled={blocked}
                      onChange={setScaleCount}
                    />
                    {[0, ...(scaleCount === '3' ? [1] : []), 2].map((index) => (
                      <label key={index} className="z-studio-sheet-rule-field">
                        <span>{['最低值', '中位数', '最高值'][index]}</span>
                        <ColorPicker
                          aria-label={`色阶${['最低值', '中位数', '最高值'][index]}颜色`}
                          value={colors[index]}
                          disabled={blocked}
                          onChange={(color) =>
                            setColors((current) =>
                              current.map((value, position) => (position === index ? color : value))
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
            {mode.kind === 'validation' && (
              <>
                <label className="z-studio-sheet-rule-field">
                  <span>允许的值</span>
                  <Select
                    aria-label="数据验证类型"
                    value={validationType}
                    options={[...validationTypes]}
                    disabled={blocked}
                    onChange={(value) => {
                      const found = validationTypes.find((option) => option.value === value);
                      if (found) setValidationType(found.value);
                    }}
                  />
                </label>
                {validationType === 'list' && (
                  <>
                    <Select
                      aria-label="列表来源类型"
                      value={listMode}
                      options={[
                        { value: 'values', label: '直接输入选项' },
                        { value: 'source', label: '引用单元格区域' },
                      ]}
                      disabled={blocked}
                      onChange={setListMode}
                    />
                    <label className="z-studio-sheet-rule-field">
                      <span>{listMode === 'source' ? '来源区域' : '列表选项，用逗号分隔'}</span>
                      <Input
                        aria-label={listMode === 'source' ? '验证列表来源' : '验证列表选项'}
                        value={listMode === 'source' ? listSource : listValues}
                        disabled={blocked}
                        onChange={(event) =>
                          listMode === 'source'
                            ? setListSource(event.target.value)
                            : setListValues(event.target.value)
                        }
                      />
                    </label>
                    <p className="z-studio-sheet-rule-hint">
                      来源可使用 =$A$1:$A$5 或 ='工作表名'!$A$1:$A$5。直接列表最多 255 个字符。
                    </p>
                  </>
                )}
              </>
            )}
            {((mode.kind === 'conditional' && conditionType === 'cellIs') ||
              (mode.kind === 'validation' &&
                validationType !== 'list' &&
                validationType !== 'custom')) && (
              <>
                <label className="z-studio-sheet-rule-field">
                  <span>比较条件</span>
                  <Select
                    aria-label="规则比较条件"
                    value={operator}
                    options={comparisons}
                    disabled={blocked}
                    onChange={(value) => {
                      const found = comparisons.find((option) => option.value === value);
                      if (found) setOperator(found.value);
                    }}
                  />
                </label>
                <div className="z-studio-sheet-rule-row">
                  <label className="z-studio-sheet-rule-field">
                    <span>{between ? '最小值' : '比较值'}</span>
                    <Input
                      aria-label="规则比较值"
                      value={first}
                      disabled={blocked}
                      onChange={(event) => setFirst(event.target.value)}
                    />
                  </label>
                  {between && (
                    <label className="z-studio-sheet-rule-field">
                      <span>最大值</span>
                      <Input
                        aria-label="规则比较值上限"
                        value={second}
                        disabled={blocked}
                        onChange={(event) => setSecond(event.target.value)}
                      />
                    </label>
                  )}
                </div>
                <p className="z-studio-sheet-rule-hint">
                  输入数字或以 = 开始的公式。日期可输入 2026-11-12，时间可输入 09:30。
                </p>
              </>
            )}
            {((mode.kind === 'conditional' && conditionType === 'expression') ||
              (mode.kind === 'validation' && validationType === 'custom')) && (
              <label className="z-studio-sheet-rule-field">
                <span>公式，结果为 TRUE 时满足条件</span>
                <Input
                  aria-label="规则公式"
                  value={formula}
                  disabled={blocked}
                  onChange={(event) => setFormula(event.target.value)}
                />
                <small>相对引用从应用范围的左上角单元格开始调整。</small>
              </label>
            )}
            {mode.kind === 'conditional' && (
              <>
                {conditionType !== 'colorScale' && (
                  <fieldset className="z-studio-sheet-rule-style">
                    <legend>满足条件时的格式</legend>
                    <div className="z-studio-sheet-rule-row">
                      <Checkbox
                        label="使用背景色"
                        checked={style.background !== undefined}
                        disabled={blocked}
                        onChange={(checked) =>
                          setStyle((current) => {
                            const next = { ...current };
                            if (checked) next.background = '#FEF3C7';
                            else delete next.background;
                            return next;
                          })
                        }
                      />
                      <ColorPicker
                        aria-label="条件背景颜色"
                        value={style.background ?? '#FEF3C7'}
                        disabled={blocked || style.background === undefined}
                        onChange={(background) =>
                          setStyle((current) => ({ ...current, background }))
                        }
                      />
                      <Checkbox
                        label="使用文字颜色"
                        checked={style.color !== undefined}
                        disabled={blocked}
                        onChange={(checked) =>
                          setStyle((current) => {
                            const next = { ...current };
                            if (checked) next.color = '#B91C1C';
                            else delete next.color;
                            return next;
                          })
                        }
                      />
                      <ColorPicker
                        aria-label="条件文字颜色"
                        value={style.color ?? '#B91C1C'}
                        disabled={blocked || style.color === undefined}
                        onChange={(color) => setStyle((current) => ({ ...current, color }))}
                      />
                    </div>
                    <div className="z-studio-sheet-rule-row">
                      <Checkbox
                        label="条件加粗"
                        checked={!!style.bold}
                        disabled={blocked}
                        onChange={(bold) => setStyle((current) => ({ ...current, bold }))}
                      />
                      <Checkbox
                        label="条件斜体"
                        checked={!!style.italic}
                        disabled={blocked}
                        onChange={(italic) => setStyle((current) => ({ ...current, italic }))}
                      />
                      <Checkbox
                        label="条件下划线"
                        checked={!!style.underline}
                        disabled={blocked}
                        onChange={(underline) => setStyle((current) => ({ ...current, underline }))}
                      />
                    </div>
                    <Input
                      aria-label="条件数字格式"
                      placeholder="数字格式（可选，例如 0.00%）"
                      value={style.numberFormat ?? ''}
                      disabled={blocked}
                      onChange={(event) =>
                        setStyle((current) => {
                          const next = { ...current };
                          if (event.target.value) next.numberFormat = event.target.value;
                          else delete next.numberFormat;
                          return next;
                        })
                      }
                    />
                  </fieldset>
                )}
                <div className="z-studio-sheet-rule-row">
                  <label className="z-studio-sheet-rule-field">
                    <span>优先级，较小的数字优先</span>
                    <Input
                      type="number"
                      min={1}
                      aria-label="条件格式优先级"
                      value={priority}
                      disabled={blocked}
                      onChange={(event) => setPriority(event.target.value)}
                    />
                  </label>
                  <Checkbox
                    label="满足后停止其他规则"
                    checked={stop}
                    disabled={blocked}
                    onChange={setStop}
                  />
                </div>
              </>
            )}
            {mode.kind === 'validation' && (
              <>
                <Checkbox
                  label="允许空白"
                  checked={allowBlank}
                  disabled={blocked}
                  onChange={setAllowBlank}
                />
                <fieldset className="z-studio-sheet-rule-style">
                  <legend>输入提示</legend>
                  <Checkbox
                    label="选中单元格时显示提示"
                    checked={showInput}
                    disabled={blocked}
                    onChange={setShowInput}
                  />
                  <Input
                    aria-label="验证输入提示标题"
                    placeholder="提示标题（可选）"
                    value={inputTitle}
                    maxLength={32}
                    disabled={blocked}
                    onChange={(event) => setInputTitle(event.target.value)}
                  />
                  <Input.Textarea
                    aria-label="验证输入提示内容"
                    rows={3}
                    placeholder="提示内容（可选）"
                    value={inputMessage}
                    maxLength={255}
                    disabled={blocked}
                    onChange={(event) => setInputMessage(event.target.value)}
                  />
                </fieldset>
                <fieldset className="z-studio-sheet-rule-style">
                  <legend>无效输入处理</legend>
                  <Checkbox
                    label="显示错误提示"
                    checked={showError}
                    disabled={blocked}
                    onChange={setShowError}
                  />
                  <Select
                    aria-label="验证错误级别"
                    value={severity}
                    options={[
                      { value: 'stop', label: '停止：拒绝无效输入' },
                      { value: 'warning', label: '警告：保留输入并标记' },
                      { value: 'information', label: '信息：保留输入并提示' },
                    ]}
                    disabled={blocked}
                    onChange={(value) => {
                      if (value === 'stop' || value === 'warning' || value === 'information')
                        setSeverity(value);
                    }}
                  />
                  <Input
                    aria-label="验证错误标题"
                    value={errorTitle}
                    maxLength={32}
                    disabled={blocked}
                    onChange={(event) => setErrorTitle(event.target.value)}
                  />
                  <Input.Textarea
                    aria-label="验证错误内容"
                    rows={3}
                    value={errorMessage}
                    maxLength={255}
                    disabled={blocked}
                    onChange={(event) => setErrorMessage(event.target.value)}
                  />
                </fieldset>
              </>
            )}
            {mode.kind === 'series' && (
              <>
                <p className="z-studio-sheet-rule-hint">
                  当前选区：{selectionRange}
                  。数字和日期支持一个种子与指定步长，或根据两个种子推算步长；文本支持末尾数字，例如
                  项目001。
                </p>
                <label className="z-studio-sheet-rule-field">
                  <span>填充方向</span>
                  <Select
                    aria-label="序列填充方向"
                    value={direction}
                    options={[
                      { value: 'down', label: '向下' },
                      { value: 'right', label: '向右' },
                    ]}
                    disabled={blocked}
                    onChange={(value) => {
                      if (value === 'down' || value === 'right') setDirection(value);
                    }}
                  />
                </label>
                <label className="z-studio-sheet-rule-field">
                  <span>序列类型</span>
                  <Select
                    aria-label="序列类型"
                    value={seriesType}
                    options={[
                      { value: 'number', label: '数字' },
                      { value: 'date', label: '日期（步长单位：天）' },
                      { value: 'text', label: '文本末尾数字' },
                    ]}
                    disabled={blocked}
                    onChange={(value) => {
                      if (value === 'number' || value === 'date' || value === 'text')
                        setSeriesType(value);
                    }}
                  />
                </label>
                <label className="z-studio-sheet-rule-field">
                  <span>用于推算的种子</span>
                  <Select
                    aria-label="序列种子数量"
                    value={seeds}
                    options={[
                      { value: '1', label: '第一个单元格' },
                      { value: '2', label: '前两个单元格' },
                    ]}
                    disabled={blocked}
                    onChange={(value) => {
                      if (value === '1' || value === '2') setSeeds(value);
                    }}
                  />
                </label>
                <label className="z-studio-sheet-rule-field">
                  <span>步长，可留空自动推算</span>
                  <Input
                    aria-label="序列步长"
                    value={step}
                    disabled={blocked}
                    onChange={(event) => setStep(event.target.value)}
                    placeholder="例如 1、2 或 -1"
                  />
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="z-studio-sheet-rule-error">
                {error}
              </p>
            )}
          </form>
          {mode.kind !== 'series' && (
            <section className="z-studio-sheet-rule-list" aria-label="当前工作表规则">
              <div className="z-studio-sheet-rule-row">
                <strong>当前工作表规则</strong>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => onEdit({ kind: mode.kind })}
                >
                  新建规则
                </Button>
              </div>
              {(mode.kind === 'conditional'
                ? [...(sheet.conditionalFormats ?? [])].sort((a, b) => a.priority - b.priority)
                : (sheet.dataValidations ?? [])
              ).map((rule, index) => (
                <div key={rule.id} className="z-studio-sheet-rule-entry">
                  <span>
                    {rule.range} · {ruleLabel(rule)}
                    {'priority' in rule ? ` · 优先级 ${rule.priority}` : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`编辑${mode.kind === 'conditional' ? '条件格式' : '数据验证'}规则 ${index + 1}`}
                    onClick={() => onEdit({ kind: mode.kind, ruleId: rule.id })}
                  >
                    查看 / 编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={blocked}
                    aria-label={`删除${mode.kind === 'conditional' ? '条件格式' : '数据验证'}规则 ${index + 1}`}
                    onClick={() =>
                      remove(mode.kind === 'conditional' ? 'conditional' : 'validation', rule.id)
                    }
                  >
                    删除
                  </Button>
                </div>
              ))}
              {!(mode.kind === 'conditional'
                ? sheet.conditionalFormats?.length
                : sheet.dataValidations?.length) && (
                <p className="z-studio-sheet-rule-hint">尚未创建规则。</p>
              )}
            </section>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>关闭</Modal.Close>
          <Button type="submit" form={formId} disabled={blocked}>
            {mode.kind === 'series' ? '填充序列' : existing ? '保存规则' : '应用规则'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
