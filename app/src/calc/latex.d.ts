export interface Equation {
  outputs: string[];
  primary: string;
  exprLatex: string;
  expr: string | null;
  domain: string | null;
  error: string | null;
}

export function latexExprToMath(src: string): string;
export function parseLatexFormula(latex: string | null): Equation[];
export function cleanSymbol(raw: string): string;
