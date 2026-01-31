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

export type Logger = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

function isTestLikeRuntime(): boolean {
  // Avoid referencing `jest` as an identifier (will fail under TS/ESM).
  const maybeJest = (globalThis as any)?.jest;
  return process.env.NODE_ENV === "test" || typeof maybeJest !== "undefined";
}

const logger: Logger = {
  log: (...args) => {
    if (!isTestLikeRuntime()) console.log(...args);
  },
  warn: (...args) => {
    if (!isTestLikeRuntime()) console.warn(...args);
  },
  error: (...args) => {
    // Keep errors visible even in tests
    console.error(...args);
  },
};

export default logger;
