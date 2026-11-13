declare module 'fast-formula-parser' {
  interface Position {
    sheet: string;
    row: number;
    col: number;
  }
  interface Range {
    sheet: string;
    from: { row: number; col: number };
    to: { row: number; col: number };
  }
  export default class FormulaParser {
    static FormulaError: { VALUE: Error; REF: Error; NAME: Error };
    constructor(options: {
      functions?: Record<string, (...args: unknown[]) => unknown>;
      onCell: (position: Position) => unknown;
      onRange: (range: Range) => unknown[][];
    });
    parse(formula: string, position: Position): unknown;
  }
}
