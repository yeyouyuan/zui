'use client';

import * as React from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Modal } from '../Modal';
import { Select } from '../Select';
import { Tabs } from '../Tabs';
import { studioResolveSheetHyperlink } from './studio-sheet-hyperlinks';
import type { StudioExcelDocument, StudioSheetHyperlink } from './studio-types';

export interface SheetHyperlinkDialogState {
  sheetId: string;
  address: string;
  link: StudioSheetHyperlink;
  displayText: string;
  isNew: boolean;
}

interface HyperlinkDialogProps {
  state: SheetHyperlinkDialogState;
  document: StudioExcelDocument;
  blocked: boolean;
  onClose(): void;
  onSave(link: StudioSheetHyperlink, displayText?: string): void;
}

export function StudioSheetHyperlinkDialog({
  state,
  document,
  blocked,
  onClose,
  onSave,
}: HyperlinkDialogProps) {
  const original = state.link;
  const [kind, setKind] = React.useState(
    original.target && !original.target.startsWith('#')
      ? 'external'
      : original.location || original.target?.startsWith('#')
        ? 'internal'
        : 'external'
  );
  const [target, setTarget] = React.useState(original.target ?? '');
  const [location, setLocation] = React.useState(
    original.location ?? original.target?.replace(/^#/, '') ?? ''
  );
  const [display, setDisplay] = React.useState(state.displayText);
  const [tooltip, setTooltip] = React.useState(original.tooltip ?? '');
  const [error, setError] = React.useState('');
  const fieldId = React.useId();
  const destination = studioResolveSheetHyperlink(document, state.sheetId, {
    ...original,
    target: undefined,
    location,
  });

  function save() {
    if (blocked) return;
    try {
      const wasInternal = !original.target || original.target.startsWith('#');
      const unchangedDestination =
        kind === 'internal'
          ? wasInternal &&
            location === (original.location ?? original.target?.replace(/^#/, '') ?? '')
          : !wasInternal && target === (original.target ?? '');
      const link: StudioSheetHyperlink = {
        ...original,
        target: kind === 'external' ? target : unchangedDestination ? original.target : undefined,
        location:
          kind === 'internal'
            ? unchangedDestination
              ? original.location
              : location
            : unchangedDestination
              ? original.location
              : undefined,
        tooltip: tooltip || undefined,
        display: display === state.displayText ? original.display : display || undefined,
      };
      onSave(link, display === state.displayText ? undefined : display);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '超链接未保存，请检查地址。');
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Content size="sm" className="z-studio-sheet-link-dialog">
        <Modal.Header>
          <Modal.Title>{state.isNew ? '插入超链接' : '编辑超链接'}</Modal.Title>
          <Modal.Close />
        </Modal.Header>
        <Modal.Body>
          <Tabs value={kind} onValueChange={setKind}>
            <Tabs.List aria-label="超链接类型">
              <Tabs.Trigger value="external" disabled={blocked}>
                网页或邮件
              </Tabs.Trigger>
              <Tabs.Trigger value="internal" disabled={blocked}>
                本文档中的位置
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Panel value="external">
              <label htmlFor={`${fieldId}-target`}>链接地址</label>
              <Input
                id={`${fieldId}-target`}
                aria-label="超链接地址"
                value={target}
                onChange={(event) => {
                  setTarget(event.target.value);
                  setError('');
                }}
                placeholder="https://example.com 或 mailto:name@example.com"
                disabled={blocked}
                spellCheck={false}
              />
            </Tabs.Panel>
            <Tabs.Panel value="internal">
              <label>工作表</label>
              <Select
                aria-label="超链接目标工作表"
                value={destination.kind === 'internal' ? destination.sheetId : ''}
                options={document.sheets.map((sheet) => ({ value: sheet.id, label: sheet.name }))}
                disabled={blocked}
                placeholder="选择目标工作表"
                onChange={(id) => {
                  const sheet = document.sheets.find((item) => item.id === id);
                  if (!sheet) return;
                  const address = location.split('!').at(-1)?.replace(/^#/, '') || 'A1';
                  setLocation(`'${sheet.name.replace(/'/g, "''")}'!${address}`);
                  setError('');
                }}
              />
              <label htmlFor={`${fieldId}-location`}>单元格引用</label>
              <Input
                id={`${fieldId}-location`}
                aria-label="超链接单元格引用"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  setError('');
                }}
                placeholder="Sheet1!A1 或 Sheet1!A1:D6"
                disabled={blocked}
                spellCheck={false}
              />
            </Tabs.Panel>
          </Tabs>
          <label htmlFor={`${fieldId}-display`}>显示文字</label>
          <Input
            id={`${fieldId}-display`}
            aria-label="超链接显示文字"
            value={display}
            onChange={(event) => setDisplay(event.target.value)}
            disabled={blocked}
          />
          <label htmlFor={`${fieldId}-tooltip`}>屏幕提示</label>
          <Input
            id={`${fieldId}-tooltip`}
            aria-label="超链接屏幕提示"
            value={tooltip}
            onChange={(event) => setTooltip(event.target.value)}
            disabled={blocked}
          />
          {error && (
            <p role="alert" className="z-studio-sheet-rule-error">
              {error}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button disabled={blocked} onClick={save}>
            确定
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
