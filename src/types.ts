export type JsonObject = Record<string, any>;

export type FormulaGlobals = Record<string, unknown>;

export type TrustReport = {
  statements?: any[];
  [k: string]: any;
};

export type StatementReport = {
  id: string;
  title?: string;
  value?: unknown;
  report_text?: unknown;
};

export type YamlDoc = {
  toJSON(): any;
};

export type ProfileDocs = YamlDoc[];
