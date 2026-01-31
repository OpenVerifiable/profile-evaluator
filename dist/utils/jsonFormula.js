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
// ESM default import may be typed as unknown; cast to a constructor we can use.
const JsonFormula = jsonFormulaImport;
export class FormulaRunner {
    myFormula;
    constructor(customFunctions = null) {
        this.myFormula = customFunctions ? new JsonFormula(customFunctions) : new JsonFormula();
    }
    run(formula, data, globals = {}) {
        try {
            const trimmed = String(formula).trim();
            // Prefer search() per json-formula docs
            return this.myFormula.search(trimmed, data, globals);
        }
        catch (error) {
            console.error("Error in FormulaRunner.run:", error);
            throw error;
        }
    }
    registerFunctions(functionsObject, globals = {}) {
        try {
            for (const [name, code] of Object.entries(functionsObject)) {
                const regFormula = `register("${name}", &${code})`;
                this.run(regFormula, {}, globals);
            }
        }
        catch (error) {
            console.error("Error in FormulaRunner.registerFunctions:", error);
            throw error;
        }
    }
}
// Legacy helper (kept as-is, but typed)
export function evaluateFormula(formula, data) {
    const myFormula = new JsonFormula();
    const trimmed = String(formula).trim();
    const dbg = [];
    const compiledFormula = myFormula.compile(trimmed, [], dbg);
    try {
        const language = "en-US";
        const globals = {};
        return myFormula.run(compiledFormula, data, language, globals);
    }
    catch (error) {
        console.error("Error in evaluateFormula:", error);
        throw error;
    }
}
// Legacy helper demo (kept as-is, but typed)
export function evaluateFormulaViaSearch(formula, data) {
    const customFunctions = {
        customFunc: {
            // eslint-disable-next-line no-unused-vars
            _func: (_args, _searchData, _interpreter) => 42,
            _signature: [],
        },
    };
    const runner = new FormulaRunner(customFunctions);
    const globals = {
        $foo: true,
        $bar: 42,
        $baz: "hello",
        $arr: [1, 2, 3],
        $days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    };
    return runner.run(formula, data, globals);
}
