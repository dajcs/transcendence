import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "<rootDir>/src/**/*.{ts,tsx}",
    "!<rootDir>/src/**/*.d.ts",
    "!<rootDir>/src/**/__tests__/**",
    "!<rootDir>/src/app/layout.tsx",
    "!<rootDir>/src/app/providers.tsx",
    "!<rootDir>/src/lib/types.ts",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/.next/",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/e2e/",
  ],
  coverageReporters: ["text", "lcov", "html"],
};

export default createJestConfig(config);
