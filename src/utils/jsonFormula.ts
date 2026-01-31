/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import jsonFormulaImport from "@adobe/json-formula";

type JsonObject = Record<string, any>;
type Globals = Record<string, any>;

// Minimal structural typing (works even if @adobe/json-formula ships no TS types)
type JsonFormulaInstance = {
  search: (expression: string, json: any, globals?: Globals) => unknown;
  compile: (expression: string, params?: any[], debug?: any[]) => unknown;
  run: (compiled: unknown, json: any, language?: string, globals?: Globals) => unknown;
};

type JsonFormulaCtor = new (customFunctions?: any) => JsonFormulaInstance;

// ESM default import may be typed as unknown; cast to a constructor we can use.
const JsonFormula = jsonFormulaImport as unknown as JsonFormulaCtor;

export class FormulaRunner {
  private myFormula: JsonFormulaInstance;

  constructor(customFunctions: any | null = null) {
    this.myFormula = customFunctions ? new JsonFormula(customFunctions) : new JsonFormula();
  }

  run(formula: string, data: any, globals: Globals = {}): unknown {
    try {
      const trimmed = String(formula).trim();
      // Prefer search() per json-formula docs
      return this.myFormula.search(trimmed, data, globals);
    } catch (error) {
      console.error("Error in FormulaRunner.run:", error);
      throw error;
    }
  }

  registerFunctions(functionsObject: Record<string, string>, globals: Globals = {}): void {
    try {
      for (const [name, code] of Object.entries(functionsObject)) {
        const regFormula = `register("${name}", &${code})`;
        this.run(regFormula, {}, globals);
      }
    } catch (error) {
      console.error("Error in FormulaRunner.registerFunctions:", error);
      throw error;
    }
  }
}

// Legacy helper (kept as-is, but typed)
export function evaluateFormula(formula: string, data: any): unknown {
  const myFormula = new JsonFormula();

  const trimmed = String(formula).trim();
  const dbg: any[] = [];
  const compiledFormula = myFormula.compile(trimmed, [], dbg);

  try {
    const language = "en-US";
    const globals: Globals = {};
    return myFormula.run(compiledFormula, data, language, globals);
  } catch (error) {
    console.error("Error in evaluateFormula:", error);
    throw error;
  }
}

// Legacy helper demo (kept as-is, but typed)
export function evaluateFormulaViaSearch(formula: string, data: any): unknown {
  const customFunctions = {
    customFunc: {
      // eslint-disable-next-line no-unused-vars
      _func: (_args: any, _searchData: any, _interpreter: any) => 42,
      _signature: [],
    },
  };

  const runner = new FormulaRunner(customFunctions);

  const globals: Globals = {
    $foo: true,
    $bar: 42,
    $baz: "hello",
    $arr: [1, 2, 3],
    $days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  };

  return runner.run(formula, data, globals);
}
