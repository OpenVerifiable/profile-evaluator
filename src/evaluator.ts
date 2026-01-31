import fs from "fs";
import path from "path";
import YAML from "yaml";
import type { FormulaGlobals, JsonObject, ProfileDocs, TrustReport } from "./types.js";
import { loadProfileDocuments } from "./utils/profileLoader.js";
import { registerEvaluatorHelpers, unregisterEvaluatorHelpers } from "./utils/handlebarHelpers.js";
import { processOneDataBlock } from "./utils/dataBlockProcessor.js";
import { processOneStatement } from "./utils/statementProcessor.js";
import { FormulaRunner } from "./utils/jsonFormula.js";
import logger from "./utils/logger.js";

export class Evaluator {
  private profile: ProfileDocs | null = null;
  private formRunner: FormulaRunner;
  private formulaGlobals: FormulaGlobals;

  constructor() {
    this.formRunner = new FormulaRunner();
    this.formulaGlobals = {};
  }

  loadProfile(profilePath: string): void {
    console.log(`📄 Loading Trust Profile from: ${profilePath}`);
    this.profile = loadProfileDocuments(profilePath);
  }

  evaluate(jsonData: JsonObject, profilePath: string): TrustReport {
    if (!this.profile) {
      throw new Error("❌ Trust Profile not loaded. Please load a profile before evaluation.");
    }

    // Register handlebars helpers so templates can call json-formula
    registerEvaluatorHelpers({
      formRunner: this.formRunner,
      jsonData,
      formulaGlobals: this.formulaGlobals,
    });

    const trustReport: TrustReport = {};

    // first YAML document contains metadata/variables/expressions/include
    const doc0 = this.profile[0].toJSON();

    // Handle includes
    if (Array.isArray(doc0.include)) {
      for (const includePath of doc0.include) {
        const resolvedPath = path.isAbsolute(includePath)
          ? includePath
          : path.resolve(path.dirname(profilePath), includePath);

        if (fs.existsSync(resolvedPath)) {
          try {
            const includeData = fs.readFileSync(resolvedPath, "utf-8");
            const includeDocs = YAML.parseAllDocuments(includeData);

            if (includeDocs.length > 0) {
              const includeDoc0 = includeDocs[0].toJSON();

              for (const [key, value] of Object.entries(includeDoc0)) {
                if (Object.prototype.hasOwnProperty.call(doc0, key)) {
                  if (
                    typeof (doc0 as any)[key] === "object" &&
                    typeof value === "object" &&
                    (doc0 as any)[key] !== null &&
                    value !== null
                  ) {
                    (doc0 as any)[key] = { ...(doc0 as any)[key], ...(value as any) };
                  } else {
                    (doc0 as any)[key] = value;
                  }
                } else {
                  (doc0 as any)[key] = value;
                }
              }

              // push remaining docs
              if (includeDocs.length > 1) {
                this.profile.push(...(includeDocs.slice(1) as any));
              }
            }

            logger.log(`🔗 Included profile loaded from: ${resolvedPath}`);
          } catch (err: any) {
            logger.log(`❌ Failed to load included profile: ${resolvedPath} (${err.message})`);
          }
        } else {
          logger.log(`❌ Included profile not found: ${resolvedPath}`);
        }
      }
    }

    // Copy doc0 fields onto jsonData for later reference in expressions/templates
    for (const [key, value] of Object.entries(doc0)) {
      (jsonData as any)[key] = value;
    }

    const metadata = (doc0 as any).metadata || (doc0 as any).profile_metadata;
    const profileInfo = `${metadata.name} (${metadata.version})`;
    logger.log(`🔍 Evaluating "${profileInfo}" from "${metadata.issuer}" dated ${metadata.date}.`);

    // Variables
    if ((doc0 as any).variables) {
      logger.log("🔍 Registering variables from the profile:");
      for (const [name, value] of Object.entries((doc0 as any).variables)) {
        logger.log(`\t- ${name}: ${value}`);
        this.formulaGlobals[name] = value as any;
      }
    }

    // Expressions (functions)
    if ((doc0 as any).expressions) {
      logger.log("🔍 Registering expressions from the profile:");
      for (const [name, expression] of Object.entries((doc0 as any).expressions)) {
        logger.log(`\t- ${name}: ${expression}`);
      }
      this.formRunner.registerFunctions((doc0 as any).expressions, (doc0 as any).variables);
    }

    logger.log(`Profile contains ${this.profile.length - 1} sections with rules.`);

    const theStatements: any[] = [];

    for (let i = 1; i < this.profile.length; i++) {
      const section = this.profile[i].toJSON();

      if (Array.isArray(section)) {
        const sectionReport: any[] = [];

        section.forEach((rule) => {
          if (!rule.id) {
            const oneDataBlock = processOneDataBlock(rule, jsonData);
            if (oneDataBlock && typeof oneDataBlock === "object") {
              for (const [key, value] of Object.entries(oneDataBlock)) {
                (trustReport as any)[key] = value;

                if (!jsonData.profile) jsonData.profile = {};
                jsonData.profile[key] = value;
              }
            }
          } else {
            const one = processOneStatement({
              statement: rule,
              jsonData,
              formRunner: this.formRunner,
              formulaGlobals: this.formulaGlobals,
            });
            sectionReport.push(one);
          }
        });

        if (sectionReport.length > 0) theStatements.push(sectionReport);
      } else {
        // not an array: treat as statement-like object
        processOneStatement({
          statement: section,
          jsonData,
          formRunner: this.formRunner,
          formulaGlobals: this.formulaGlobals,
        });
      }
    }

    trustReport.statements = theStatements;

    // cleanup helpers so we don't leak them across requests
    unregisterEvaluatorHelpers();

    return trustReport;
  }
}

export default Evaluator;
