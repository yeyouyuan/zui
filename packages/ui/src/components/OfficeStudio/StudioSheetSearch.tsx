'use client';

import * as React from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Select } from '../Select';
import { Checkbox } from '../Checkbox';
import type { StudioExcelDocument } from './studio-types';
import { studioCellAddress, studioParseAddress, type SheetSelection } from './studio-sheet-model';
import {
  studioFindSheetCells,
  type StudioSheetSearchOptions,
  type StudioSheetMatch,
} from './studio-sheet-editing';

export function StudioSheetSearch({
  document,
  activeSheetId,
  selection,
  snapshot,
  mode,
  focusVersion,
  disabled,
  readOnly,
  onModeChange,
  onNavigate,
  onReplace,
  onClose,
}: {
  document: StudioExcelDocument;
  activeSheetId: string;
  selection: SheetSelection;
  snapshot: { sheetId: string; selection: SheetSelection };
  mode: 'find' | 'replace';
  focusVersion?: number;
  disabled?: boolean;
  readOnly?: boolean;
  onModeChange: (mode: 'find' | 'replace') => void;
  onNavigate: (match: StudioSheetMatch) => void;
  onReplace: (
    options: StudioSheetSearchOptions,
    replacement: string,
    only?: StudioSheetMatch
  ) => string;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState('');
  const [replacement, setReplacement] = React.useState('');
  const [scope, setScope] = React.useState<StudioSheetSearchOptions['scope']>('sheet');
  const [lookIn, setLookIn] = React.useState<StudioSheetSearchOptions['lookIn']>('formulas');
  const [order, setOrder] = React.useState<'rows' | 'columns'>('rows');
  const [matchCase, setMatchCase] = React.useState(false);
  const [wholeCell, setWholeCell] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    inputRef.current?.focus();
  }, [mode, focusVersion]);
  const options = React.useMemo<StudioSheetSearchOptions>(
    () => ({
      query,
      scope,
      lookIn,
      order,
      matchCase,
      wholeCell,
      sheetId: scope === 'selection' ? snapshot.sheetId : activeSheetId,
      selection: snapshot.selection,
    }),
    [query, scope, lookIn, order, matchCase, wholeCell, activeSheetId, snapshot]
  );
  const result = React.useMemo(() => {
    try {
      return { matches: studioFindSheetCells(document, options), error: '' };
    } catch (error) {
      return { matches: [], error: error instanceof Error ? error.message : '查找失败。' };
    }
  }, [document, options]);
  const address = studioCellAddress(selection.focus.row, selection.focus.col);
  const currentIndex = result.matches.findIndex(
    (match) => match.sheetId === activeSheetId && match.address === address
  );
  function navigate(direction: 1 | -1) {
    if (disabled || !result.matches.length) return;
    let index = currentIndex;
    if (index < 0) {
      const sheetIndex = document.sheets.findIndex((sheet) => sheet.id === activeSheetId);
      const after = result.matches.findIndex((match) => {
        const matchSheet = document.sheets.findIndex((sheet) => sheet.id === match.sheetId);
        const position = studioParseAddress(match.address)!;
        const delta =
          order === 'rows'
            ? position.row - selection.focus.row || position.col - selection.focus.col
            : position.col - selection.focus.col || position.row - selection.focus.row;
        return matchSheet > sheetIndex || (matchSheet === sheetIndex && delta > 0);
      });
      index =
        direction === 1
          ? after < 0
            ? 0
            : after
          : after < 0
            ? result.matches.length - 1
            : (after - 1 + result.matches.length) % result.matches.length;
    } else index = (index + direction + result.matches.length) % result.matches.length;
    onNavigate(result.matches[index]);
    setMessage(
      `第 ${index + 1} / ${result.matches.length} 项；${direction === 1 && index === 0 ? '已循环至开头。' : direction === -1 && index === result.matches.length - 1 ? '已循环至末尾。' : ''}`
    );
  }
  function replace(all: boolean) {
    if (disabled || readOnly || (!all && currentIndex < 0)) return;
    setMessage(onReplace(options, replacement, all ? undefined : result.matches[currentIndex]));
  }
  return (
    <section
      className="z-studio-sheet-search"
      aria-label="表格查找与替换"
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="z-studio-sheet-search-row">
        <strong>查找与替换</strong>
        <Button
          size="sm"
          variant={mode === 'find' ? 'outline' : 'ghost'}
          aria-pressed={mode === 'find'}
          disabled={disabled}
          onClick={() => onModeChange('find')}
        >
          查找
        </Button>
        <Button
          size="sm"
          variant={mode === 'replace' ? 'outline' : 'ghost'}
          aria-pressed={mode === 'replace'}
          disabled={disabled || readOnly}
          onClick={() => onModeChange('replace')}
        >
          替换
        </Button>
        <Button size="sm" variant="ghost" aria-label="关闭表格查找" onClick={onClose}>
          关闭
        </Button>
      </div>
      <form
        className="z-studio-sheet-search-row"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(1);
        }}
      >
        <Input
          ref={inputRef}
          size="sm"
          aria-label="表格查找内容"
          placeholder="查找内容"
          value={query}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage('');
          }}
        />
        <Button size="sm" type="submit" disabled={disabled || !result.matches.length}>
          查找下一个
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !result.matches.length}
          onClick={() => navigate(-1)}
          type="button"
        >
          查找上一个
        </Button>
        {mode === 'replace' && (
          <>
            <Input
              size="sm"
              aria-label="表格替换为"
              placeholder="替换为（可为空）"
              value={replacement}
              disabled={disabled || readOnly}
              onChange={(event) => setReplacement(event.target.value)}
            />
            <Button
              size="sm"
              disabled={
                disabled ||
                readOnly ||
                currentIndex < 0 ||
                !result.matches[currentIndex]?.replaceable
              }
              onClick={() => replace(false)}
              type="button"
            >
              替换当前
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || readOnly || !result.matches.some((match) => match.replaceable)}
              onClick={() => replace(true)}
              type="button"
            >
              全部替换
            </Button>
          </>
        )}
      </form>
      <div className="z-studio-sheet-search-row">
        <Select
          size="sm"
          aria-label="表格查找范围"
          value={scope}
          disabled={disabled}
          onChange={(value) => {
            setScope(value as StudioSheetSearchOptions['scope']);
            setMessage('');
          }}
          options={[
            { value: 'sheet', label: '当前工作表' },
            { value: 'workbook', label: '整个工作簿' },
            { value: 'selection', label: '打开时的选区' },
          ]}
        />
        <Select
          size="sm"
          aria-label="表格查找位置"
          value={lookIn}
          disabled={disabled}
          onChange={(value) => {
            setLookIn(value as StudioSheetSearchOptions['lookIn']);
            setMessage('');
          }}
          options={[
            { value: 'formulas', label: '公式与原始内容' },
            { value: 'values', label: '显示值' },
          ]}
        />
        <Select
          size="sm"
          aria-label="表格查找顺序"
          value={order}
          disabled={disabled}
          onChange={(value) => setOrder(value as 'rows' | 'columns')}
          options={[
            { value: 'rows', label: '按行查找' },
            { value: 'columns', label: '按列查找' },
          ]}
        />
        <Checkbox
          label="区分大小写"
          checked={matchCase}
          disabled={disabled}
          onChange={setMatchCase}
        />
        <Checkbox
          label="匹配整个单元格"
          checked={wholeCell}
          disabled={disabled}
          onChange={setWholeCell}
        />
      </div>
      <p role="status" className="z-studio-sheet-search-status">
        {result.error ||
          (query
            ? `找到 ${result.matches.length} 个单元格${currentIndex >= 0 ? `，当前第 ${currentIndex + 1} 项` : ''}。`
            : '输入内容开始查找。')}{' '}
        {message}
      </p>
      <p className="z-studio-sheet-search-hint">
        支持 *、? 通配符，~ 转义；Enter 查找下一项，Esc
        关闭。显示值中的公式及无法对应原始内容的格式化数值会跳过替换。
      </p>
    </section>
  );
}
