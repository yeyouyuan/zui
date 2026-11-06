/**
 * Zero-dependency Node.js built-in type shims for @zui/mcp.
 *
 * Why: the workspace ships no `@types/node` and the pnpm lockfile must not be
 * touched during parallel development, so this package compiles with nothing
 * but `typescript`. `tsconfig.json` sets `"types": []`, which makes these the
 * only Node typings in effect (no conflict even if `@types/node` is installed
 * later). If the workspace adopts `@types/node`, delete this file and drop
 * `"types": []` from tsconfig.json.
 */

interface ImportMeta {
  url: string;
}

declare module 'node:fs' {
  export interface DirentLike {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }
  export function readdirSync(path: string, options: { withFileTypes: true }): DirentLike[];
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function existsSync(path: string): boolean;
  export function realpathSync(path: string): string;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string): string;
}

declare module 'node:process' {
  export interface ReadableLike {
    on(event: 'data', listener: (chunk: unknown) => void): unknown;
    on(event: 'end', listener: () => void): unknown;
    setEncoding(encoding: 'utf8'): unknown;
  }
  export interface WritableLike {
    write(chunk: string): unknown;
  }
  export interface ProcessLike {
    argv: string[];
    env: Record<string, string | undefined>;
    stdin: ReadableLike;
    stdout: WritableLike;
    stderr: WritableLike;
    cwd(): string;
    exit(code?: number): never;
  }
  const process: ProcessLike;
  export default process;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:child_process' {
  export interface ChildProcessLike {
    stdin: { write(chunk: string): unknown; end(): unknown };
    stdout: {
      on(event: 'data', listener: (chunk: unknown) => void): unknown;
      setEncoding(encoding: 'utf8'): unknown;
    };
    stderr: { on(event: 'data', listener: (chunk: unknown) => void): unknown };
    on(event: 'exit', listener: (code: number | null) => void): unknown;
    on(event: 'error', listener: (error: unknown) => void): unknown;
    kill(): unknown;
  }
  export function spawn(
    command: string,
    args?: string[],
    options?: { cwd?: string; env?: Record<string, string | undefined> },
  ): ChildProcessLike;
}

declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  const assert: {
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    strictEqual(actual: unknown, expected: unknown, message?: string): void;
    deepStrictEqual(actual: unknown, expected: unknown, message?: string): void;
    match(value: string, regExp: RegExp, message?: string): void;
    doesNotMatch(value: string, regExp: RegExp, message?: string): void;
    fail(message?: string): never;
  };
  export default assert;
}

declare module 'node:timers/promises' {
  export function setTimeout(delay: number, value?: unknown): Promise<unknown>;
}
