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
    "!<rootDir>/src/app/api/**",
    "!<rootDir>/src/app/page.tsx",
    "!<rootDir>/src/app/(auth)/**/page.tsx",
    "!<rootDir>/src/app/layout.tsx",
    "!<rootDir>/src/app/providers.tsx",
    "!<rootDir>/src/app/privacy/page.tsx",
    "!<rootDir>/src/app/terms/page.tsx",
    "!<rootDir>/src/components/AppShell.tsx",
    "!<rootDir>/src/components/Footer.tsx",
    "!<rootDir>/src/components/QueryProvider.tsx",
    "!<rootDir>/src/i18n/**",
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
  coverageThreshold: {
    global: {
      statements: 54,
      lines: 57,
    },
  },
};

export default createJestConfig(config);
