import fs from "fs";
import path from "path";
import YAML from "yaml";
/**
 * Loads the trust profile YAML as multi-document YAML.
 * Returns the raw YAML Document objects so callers can use .toJSON().
 */
export function loadProfileDocuments(profilePath) {
    const fullPath = path.resolve(profilePath);
    const profileData = fs.readFileSync(fullPath, "utf-8");
    return YAML.parseAllDocuments(profileData);
}
