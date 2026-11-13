import type { Buffer } from 'node:buffer';

export interface OfficeFontManifest {
  schema: number;
  package: { name: string; version: string };
  license: { file: string; sha256: string };
  fonts: {
    file: string;
    weight: number;
    sourceFile: string;
    sourceSha256: string;
    sha256: string;
    size: number;
  }[];
}

export function trueTypeFromWoff(woff: Uint8Array): Buffer;
export function prepareOfficeFonts(options?: { fontRoot?: string; outputDirectory?: string }): {
  directory: string;
  changed: boolean;
  manifest: OfficeFontManifest;
};
