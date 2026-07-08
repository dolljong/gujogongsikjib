export type Dimension =
  | "length"
  | "force"
  | "dist_load"
  | "moment"
  | "stress"
  | "modulus"
  | "area"
  | "Zmod"
  | "inertia"
  | "angle"
  | "temp"
  | "expansion"
  | "dimensionless"
  | "unknown";

export interface VarRecord {
  sym: string;
  desc: string;
}

export function canonSym(raw: string): string;
export function parseVariables(variables: string | null): VarRecord[];
export function classifyDesc(desc: string): Dimension;
export function buildDimensionMap(c: import("../types").Case): Map<string, Dimension>;
