// Types for boundaries.mjs, so the TypeScript tests and scripts can use its check().

export type Breach =
  | { kind: "deep"; data: { target: string; to: string } }
  | { kind: "direction"; data: { from: string; to: string; allowed: string } }
  | { kind: "kernel"; data: { file: string; to: string } }
  | { kind: "edge"; data: { target: string } };

export declare const MODULES: Record<string, string[]>;
export declare function areaOf(file: string): { module: string | null; edge: boolean; kernel: boolean };
export declare function undeclared(file: string): string | null;
export declare function resolve(file: string, spec: string): string | null;
export declare function moduleOf(target: string | null): string | null;
export declare function check(file: string, spec: string): Breach | null;

declare const plugin: import("eslint").ESLint.Plugin;
export default plugin;
