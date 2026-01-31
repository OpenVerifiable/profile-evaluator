import Handlebars from "handlebars";
import type { JsonObject, FormulaGlobals } from "../types.js";

type RunnerLike = {
  run: (expr: string, jsonData: JsonObject, globals?: FormulaGlobals) => unknown;
};

export function registerEvaluatorHelpers(params: {
  formRunner: RunnerLike;
  jsonData: JsonObject;
  formulaGlobals: FormulaGlobals;
}) {
  const { formRunner, jsonData, formulaGlobals } = params;

  // Allows {{expr "someFormula(...)"}}
  Handlebars.registerHelper("expr", function (arg1: string) {
    const result = formRunner.run(arg1, jsonData, formulaGlobals);
    if (typeof result === "object" && result !== null) {
      return new Handlebars.SafeString(JSON.stringify(result));
    }
    return result as any;
  });

  // Allows {{str someObject}}
  Handlebars.registerHelper("str", function (arg1: unknown) {
    return new Handlebars.SafeString(JSON.stringify(arg1));
  });

  // Helpful debugging of missing helpers / missing keys
  Handlebars.registerHelper("helperMissing", function (...args: any[]) {
    const options = args[args.length - 1];
    const callArgs = args.slice(0, -1);
    return new Handlebars.SafeString(
      "🔴 Missing: " + options.name + "(" + callArgs + ")"
    );
  });
}

export function unregisterEvaluatorHelpers() {
  Handlebars.unregisterHelper("expr");
  Handlebars.unregisterHelper("str");
  Handlebars.unregisterHelper("helperMissing");
}
