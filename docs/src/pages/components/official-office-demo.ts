import type { OfficeEditorConfig } from '@zui/react';

export type OfficialOfficeDemoKind = 'word' | 'excel' | 'pdf';

/**
 * Public service used by ONLYOFFICE's own API documentation examples.
 * Keep this path restricted to the bundled ONLYOFFICE sample documents.
 */
export const ONLYOFFICE_OFFICIAL_DEMO_SERVER = 'https://api.docs.onlyoffice.com/';

// Public demo secret published in ONLYOFFICE/api.onlyoffice.com. It is only
// suitable for the official sample server and must never replace an app's
// private, server-side JWT secret.
const ONLYOFFICE_OFFICIAL_DEMO_SECRET = 'NsOb2yUBaI9yme0wbkGAapi';

const examples = {
  word: {
    documentType: 'word',
    extension: 'docx',
    title: 'ZUI-OfficeEditor-Word-Demo.docx',
  },
  excel: {
    documentType: 'cell',
    extension: 'xlsx',
    title: 'ZUI-OfficeEditor-Excel-Demo.xlsx',
  },
  pdf: {
    documentType: 'pdf',
    extension: 'pdf',
    title: 'ZUI-OfficeEditor-PDF-Demo.pdf',
  },
} as const satisfies Record<
  OfficialOfficeDemoKind,
  { documentType: string; extension: string; title: string }
>;

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

async function signDemoConfig(config: OfficeEditorConfig): Promise<string> {
  const header = jsonToBase64Url({ typ: 'JWT', alg: 'HS256' });
  const payload = jsonToBase64Url(config);
  const message = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ONLYOFFICE_OFFICIAL_DEMO_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return `${message}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function sessionKey(kind: OfficialOfficeDemoKind): string {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `zui-demo-${kind}-${Date.now()}-${random[0].toString(36)}${random[1].toString(36)}`;
}

export function usesOfficialOfficeDemo(
  location: Pick<Location, 'hostname' | 'search'> | undefined = typeof window === 'undefined'
    ? undefined
    : window.location
): boolean {
  if (!location) return false;
  const requested = new URLSearchParams(location.search).get('office-demo');
  if (requested === 'official') return true;
  if (requested === 'local') return false;
  return location.hostname.endsWith('.github.io');
}

export async function createOfficialOfficeDemoConfig(
  kind: OfficialOfficeDemoKind
): Promise<OfficeEditorConfig> {
  const example = examples[kind];
  const config: OfficeEditorConfig = {
    type: 'desktop',
    documentType: example.documentType,
    document: {
      fileType: example.extension,
      key: sessionKey(kind),
      title: example.title,
      url: `https://static.onlyoffice.com/assets/docs/samples/demo.${example.extension}`,
      permissions: {
        comment: true,
        copy: true,
        download: true,
        edit: true,
        fillForms: true,
        print: true,
        review: true,
      },
    },
    editorConfig: {
      callbackUrl: '',
      lang: 'zh-CN',
      mode: 'edit',
      user: {
        id: `zui-demo-${kind}`,
        name: 'ZUI Demo 访客',
      },
      customization: {
        anonymous: { request: false, label: 'ZUI Demo 访客' },
        autosave: false,
        feedback: false,
        forcesave: false,
        help: false,
        hideRightMenu: true,
        features: { featuresTips: false },
        uiTheme: 'default-light',
        unit: 'cm',
      },
    },
  };
  return { ...config, token: await signDemoConfig(config) };
}
