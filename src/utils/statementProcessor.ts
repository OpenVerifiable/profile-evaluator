import Handlebars from "handlebars";
import logger from "./logger.js";
import type { JsonObject, StatementReport, FormulaGlobals } from "../types.js";

type RunnerLike = {
  run: (expr: string, jsonData: JsonObject, globals?: FormulaGlobals) => unknown;
};

export function processOneStatement(params: {
  statement: any;
  jsonData: JsonObject;
  formRunner: RunnerLike;
  formulaGlobals: FormulaGlobals;
}): StatementReport {
  const { statement, jsonData, formRunner, formulaGlobals } = params;

  const statementReport: StatementReport = { id: String(statement.id || "") };
  if (!statementReport.id) {
    throw new Error(`❌ Statement is missing an ID: ${JSON.stringify(statement)}`);
  }

  // Information statement (no expression)
  if (!statement.expression) {
    logger.log(`\tProcessing information with ID: ${statement.id}`);

    if (statement.title) {
      logger.log(`\t\tDescription: ${statement.title}`);
      statementReport.title = statement.title;
    }

    if (!statement.report_text) {
      throw new Error(`❌ Statement is missing report_text: ${JSON.stringify(statement)}`);
    }

    let reportText: string = statement.report_text;

    if (reportText && reportText.includes("{{")) {
      const template = Handlebars.compile(reportText);
      reportText = template(jsonData);
    }

    logger.log(`\t\tReport Text: ${reportText}`);
    statementReport.report_text = reportText;
    return statementReport;
  }

  // Expression statement
  logger.log(`\tProcessing expression with ID: ${statement.id}`);

  if (String(statement.id).startsWith("jpt.")) {
    logger.log(`\t\tSpecial "predefined statement": ${statement.id}`);
    // TODO: implement predefined statements if needed
  }

  const result = formRunner.run(statement.expression, jsonData, formulaGlobals);
  logger.log("\t\tResult:", result);
  statementReport.value = result;

  // persist into jsonData.profile
  if (!jsonData.profile) jsonData.profile = {};
  jsonData.profile[statement.id] = result;

  if (!statement.report_text) {
    throw new Error(`❌ Statement is missing report_text: ${JSON.stringify(statement)}`);
  }

  // report_text keyed by boolean results
  if (typeof result === "boolean") {
    const reportTextObj = statement.report_text[result ? "true" : "false"];
    if (typeof reportTextObj === "object" && reportTextObj !== null) {
      const repLang = "en";
      let reportText = reportTextObj[repLang];

      if (reportText && reportText.includes("{{")) {
        const template = Handlebars.compile(reportText);
        reportText = template(jsonData);
      }

      logger.log(`\t\tReport Text: ${reportText}`);
      statementReport.report_text = reportText;
    } else {
      logger.log("\t\tNo report text found!");
    }
  }

  return statementReport;
}
