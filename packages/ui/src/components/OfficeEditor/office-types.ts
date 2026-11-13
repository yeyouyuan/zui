import type * as React from 'react';

export interface OfficeEditorEvent<T = unknown> {
  data?: T;
  target?: unknown;
  [key: string]: unknown;
}

export type OfficeEditorEvents = Record<string, (event: OfficeEditorEvent) => void>;

/** Backend-issued configuration. The wrapper never rewrites its signed fields. */
export interface OfficeEditorConfig {
  document: {
    key: string;
    title?: string;
    url?: string;
    fileType?: string;
    permissions?: Record<string, unknown>;
    [key: string]: unknown;
  };
  documentType?: string;
  editorConfig?: {
    mode?: string;
    [key: string]: unknown;
  };
  token?: string;
  type?: string;
  width?: number | string;
  height?: number | string;
  events?: OfficeEditorEvents;
  [key: string]: unknown;
}

/** Only the native lifecycle method used by this wrapper is assumed. */
export interface OfficeEditorInstance {
  destroyEditor(): void;
}

export interface OfficeDocsApi {
  DocEditor: new (id: string, config: OfficeEditorConfig) => OfficeEditorInstance;
}

export type OfficeEditorStatus = 'loading' | 'ready' | 'error';
/** Document family; it only drives the surrounding chrome theme. */
export type OfficeEditorKind = 'word' | 'excel' | 'pdf';
export type OfficeEditorErrorCode =
  | 'invalid-config'
  | 'script-load'
  | 'script-timeout'
  | 'api-unavailable'
  | 'editor-create'
  | 'ready-timeout'
  | 'editor'
  | 'event-handler'
  | 'save'
  | 'download';

export class OfficeEditorError extends Error {
  constructor(
    readonly code: OfficeEditorErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OfficeEditorError';
  }
}

export interface OfficeEditorHandle {
  /** Recreates the editor with the latest backend-issued configuration. */
  reload(): void;
  getEditor(): OfficeEditorInstance | null;
  /** Changes the surrounding layout; it does not change native permissions. */
  setFullscreen(value: boolean): void;
}

export interface OfficeEditorToolbarContext {
  status: OfficeEditorStatus;
  editor: OfficeEditorInstance | null;
  error: OfficeEditorError | null;
  saving: boolean;
  downloading: boolean;
  fullscreen: boolean;
  disabled: boolean;
  reload(): void;
  save(): Promise<void>;
  download(): Promise<void>;
  setFullscreen(value: boolean): void;
}

export interface OfficeEditorLabels {
  editor: string;
  loading: string;
  ready: string;
  error: string;
  save: string;
  saving: string;
  download: string;
  downloading: string;
  reload: string;
  retrySave: string;
  retryDownload: string;
  enterFullscreen: string;
  exitFullscreen: string;
}

export interface OfficeEditorProps extends Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'children' | 'title' | 'onError'
> {
  ref?: React.Ref<OfficeEditorHandle>;
  documentServerUrl: string;
  config: OfficeEditorConfig;
  /** Themes the wrapper chrome per document family; native rights stay signed. */
  kind?: OfficeEditorKind;
  /**
   * Fills `editorConfig.customization` keys the backend configuration does not
   * set. Signed config values always win; changing it recreates the editor.
   */
  customization?: Record<string, unknown>;
  /** Pauses wrapper interactions; readonly rights belong in the signed configuration. */
  disabled?: boolean;
  /** Both config.events and these handlers run; callback updates keep the editor. */
  events?: OfficeEditorEvents;
  onReady?: (editor: OfficeEditorInstance, event: OfficeEditorEvent) => void;
  onStatusChange?: (status: OfficeEditorStatus) => void;
  onError?: (error: OfficeEditorError) => void;
  /** Business callbacks, usually backed by a server-side force-save/download API. */
  onSave?: (editor: OfficeEditorInstance) => void | Promise<void>;
  onDownload?: (editor: OfficeEditorInstance) => void | Promise<void>;
  title?: React.ReactNode;
  header?: React.ReactNode | ((context: OfficeEditorToolbarContext) => React.ReactNode);
  /** false hides the default top bar without hiding the native editor UI. */
  toolbar?: React.ReactNode | ((context: OfficeEditorToolbarContext) => React.ReactNode);
  height?: number | string;
  fullscreen?: boolean;
  defaultFullscreen?: boolean;
  onFullscreenChange?: (value: boolean) => void;
  allowFullscreen?: boolean;
  loading?: React.ReactNode;
  renderError?: (error: OfficeEditorError, retry: () => void) => React.ReactNode;
  labels?: Partial<OfficeEditorLabels>;
  scriptTimeout?: number;
  readyTimeout?: number;
  scriptNonce?: string;
  /** Explicitly recreates the editor when a host needs a new session with the same key. */
  rebuildKey?: string | number;
  classNames?: {
    root?: string;
    header?: string;
    toolbar?: string;
    heading?: string;
    title?: string;
    brand?: string;
    status?: string;
    actions?: string;
    stage?: string;
    canvas?: string;
    overlay?: string;
    error?: string;
    notice?: string;
  };
}
