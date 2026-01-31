import Handlebars from "handlebars";
import logger from "./logger.js";
import type { JsonObject } from "../types.js";

function processOneItem(item: unknown, jsonData: JsonObject): unknown {
  let outValue: unknown = item;

  if (typeof item === "string") {
    const trimmed = item.trim();
    if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
      const template = Handlebars.compile(trimmed, { noEscape: true });
      outValue = template(jsonData);
    }
  }

  // coerce boolean/number when possible
  if (typeof outValue === "string") {
    const lower = outValue.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;

    const num = Number(outValue);
    if (!Number.isNaN(num) && outValue.trim() !== "") return num;
  }

  // attempt JSON parse (object/array) and recursively process embedded strings
  try {
    const parsed = JSON.parse(String(outValue));
    if (typeof parsed === "object" && parsed !== null) {
      if (Array.isArray(parsed)) {
        return parsed.map((child) =>
          typeof child === "string" ? processOneItem(child, jsonData) : child
        );
      }
      for (const key of Object.keys(parsed)) {
        if (typeof parsed[key] === "string") {
          parsed[key] = processOneItem(parsed[key], jsonData);
        }
      }
      return parsed;
    }
  } catch {
    // ignore if not JSON
  }

  return outValue;
}

/**
 * Processes a "block" rule in the profile.
 * Returns a top-level object: { [blockName]: computedValue }.
 */
export function processOneDataBlock(
  dataBlock: any,
  jsonData: JsonObject
): Record<string, any> | undefined {
  if (typeof dataBlock !== "object" || dataBlock === null) return;

  const output: Record<string, any> = {};

  if (!dataBlock.block) return;
  const input = dataBlock.block;

  logger.log(`\tProcessing data block with name: ${input.name}`);

  if (Array.isArray(input.value)) {
    output[input.name] = input.value.map((it: unknown) => processOneItem(it, jsonData));
  } else if (typeof input.value === "object" && input.value !== null) {
    output[input.name] = {};
    for (const [key, value] of Object.entries(input.value)) {
      if (key === "name") continue;
      output[input.name][key] = processOneItem(value, jsonData);
    }
  } else {
    output[input.name] = processOneItem(input.value, jsonData);
  }

  return output;
}
