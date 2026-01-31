import fs from "fs";
import path from "path";
import YAML from "yaml";
import { loadProfileDocuments } from "./utils/profileLoader.js";
import { registerEvaluatorHelpers, unregisterEvaluatorHelpers } from "./utils/handlebarHelpers.js";
import { processOneDataBlock } from "./utils/dataBlockProcessor.js";
import { processOneStatement } from "./utils/statementProcessor.js";
import { FormulaRunner } from "./utils/jsonFormula.js";
import logger from "./utils/logger.js";
export class Evaluator {
    profile = null;
    formRunner;
    formulaGlobals;
    constructor() {
        this.formRunner = new FormulaRunner();
        this.formulaGlobals = {};
    }
    loadProfile(profilePath) {
        console.log(`📄 Loading Trust Profile from: ${profilePath}`);
        this.profile = loadProfileDocuments(profilePath);
    }
    evaluate(jsonData, profilePath) {
        if (!this.profile) {
            throw new Error("❌ Trust Profile not loaded. Please load a profile before evaluation.");
        }
        // Register handlebars helpers so templates can call json-formula
        registerEvaluatorHelpers({
            formRunner: this.formRunner,
            jsonData,
            formulaGlobals: this.formulaGlobals,
        });
        const trustReport = {};
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
                                    if (typeof doc0[key] === "object" &&
                                        typeof value === "object" &&
                                        doc0[key] !== null &&
                                        value !== null) {
                                        doc0[key] = { ...doc0[key], ...value };
                                    }
                                    else {
                                        doc0[key] = value;
                                    }
                                }
                                else {
                                    doc0[key] = value;
                                }
                            }
                            // push remaining docs
                            if (includeDocs.length > 1) {
                                this.profile.push(...includeDocs.slice(1));
                            }
                        }
                        logger.log(`🔗 Included profile loaded from: ${resolvedPath}`);
                    }
                    catch (err) {
                        logger.log(`❌ Failed to load included profile: ${resolvedPath} (${err.message})`);
                    }
                }
                else {
                    logger.log(`❌ Included profile not found: ${resolvedPath}`);
                }
            }
        }
        // Copy doc0 fields onto jsonData for later reference in expressions/templates
        for (const [key, value] of Object.entries(doc0)) {
            jsonData[key] = value;
        }
        const metadata = doc0.metadata || doc0.profile_metadata;
        const profileInfo = `${metadata.name} (${metadata.version})`;
        logger.log(`🔍 Evaluating "${profileInfo}" from "${metadata.issuer}" dated ${metadata.date}.`);
        // Variables
        if (doc0.variables) {
            logger.log("🔍 Registering variables from the profile:");
            for (const [name, value] of Object.entries(doc0.variables)) {
                logger.log(`\t- ${name}: ${value}`);
                this.formulaGlobals[name] = value;
            }
        }
        // Expressions (functions)
        if (doc0.expressions) {
            logger.log("🔍 Registering expressions from the profile:");
            for (const [name, expression] of Object.entries(doc0.expressions)) {
                logger.log(`\t- ${name}: ${expression}`);
            }
            this.formRunner.registerFunctions(doc0.expressions, doc0.variables);
        }
        logger.log(`Profile contains ${this.profile.length - 1} sections with rules.`);
        const theStatements = [];
        for (let i = 1; i < this.profile.length; i++) {
            const section = this.profile[i].toJSON();
            if (Array.isArray(section)) {
                const sectionReport = [];
                section.forEach((rule) => {
                    if (!rule.id) {
                        const oneDataBlock = processOneDataBlock(rule, jsonData);
                        if (oneDataBlock && typeof oneDataBlock === "object") {
                            for (const [key, value] of Object.entries(oneDataBlock)) {
                                trustReport[key] = value;
                                if (!jsonData.profile)
                                    jsonData.profile = {};
                                jsonData.profile[key] = value;
                            }
                        }
                    }
                    else {
                        const one = processOneStatement({
                            statement: rule,
                            jsonData,
                            formRunner: this.formRunner,
                            formulaGlobals: this.formulaGlobals,
                        });
                        sectionReport.push(one);
                    }
                });
                if (sectionReport.length > 0)
                    theStatements.push(sectionReport);
            }
            else {
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
