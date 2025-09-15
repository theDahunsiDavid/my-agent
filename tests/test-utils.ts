import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { simpleGit } from "simple-git";

// Test data types
export interface MockFileChange {
  file: string;
  insertions: number;
  deletions: number;
  binary: boolean;
}

export interface TestScenario {
  name: string;
  files: MockFileChange[];
  expectedType: string;
  expectedScope?: string;
  description: string;
}

// Mock Git repository utilities
export class MockGitRepo {
  public readonly path: string;

  constructor(basePath: string = "/tmp") {
    this.path = join(
      basePath,
      `test-repo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
  }

  async setup(): Promise<void> {
    try {
      // Create directory
      if (!existsSync(this.path)) {
        mkdirSync(this.path, { recursive: true });
      }

      // Initialize git repo
      const git = simpleGit(this.path);
      await git.init();
      await git.addConfig("user.name", "Test User");
      await git.addConfig("user.email", "test@example.com");

      // Create initial commit
      writeFileSync(join(this.path, "README.md"), "# Test Repository\n");
      await git.add("README.md");
      await git.commit("Initial commit");
    } catch (error) {
      console.error("Failed to setup mock Git repo:", error);
      throw error;
    }
  }

  async addFile(filePath: string, content: string): Promise<void> {
    const fullPath = join(this.path, filePath);
    const dir = join(fullPath, "..");

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content);

    // Stage the file for commit
    const git = simpleGit(this.path);
    await git.add(filePath);
  }

  async modifyFile(filePath: string, newContent: string): Promise<void> {
    const fullPath = join(this.path, filePath);
    writeFileSync(fullPath, newContent);

    // Stage the modified file
    const git = simpleGit(this.path);
    await git.add(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    const git = simpleGit(this.path);
    await git.rm(filePath);
  }

  async commit(message: string): Promise<void> {
    const git = simpleGit(this.path);
    await git.commit(message);
  }

  cleanup(): void {
    try {
      if (existsSync(this.path)) {
        rmSync(this.path, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn("Failed to cleanup mock repo:", error);
    }
  }
}

// Test scenario generators
export const testScenarios: TestScenario[] = [
  {
    name: "New feature with TypeScript files",
    files: [
      {
        file: "src/features/auth.ts",
        insertions: 50,
        deletions: 0,
        binary: false,
      },
      {
        file: "src/types/user.ts",
        insertions: 20,
        deletions: 0,
        binary: false,
      },
    ],
    expectedType: "feat",
    expectedScope: "auth",
    description: "Should detect new feature in auth domain",
  },
  {
    name: "Bug fix in existing file",
    files: [
      {
        file: "src/utils/validation.ts",
        insertions: 5,
        deletions: 3,
        binary: false,
      },
    ],
    expectedType: "fix",
    expectedScope: "utils",
    description: "Should detect bug fix in utils",
  },
  {
    name: "Documentation update",
    files: [
      { file: "README.md", insertions: 10, deletions: 2, binary: false },
      { file: "docs/api.md", insertions: 15, deletions: 0, binary: false },
    ],
    expectedType: "docs",
    description: "Should detect documentation changes",
  },
  {
    name: "Test files only",
    files: [
      {
        file: "src/__tests__/auth.test.ts",
        insertions: 30,
        deletions: 0,
        binary: false,
      },
      {
        file: "src/utils/validation.spec.ts",
        insertions: 20,
        deletions: 5,
        binary: false,
      },
    ],
    expectedType: "test",
    description: "Should detect test-only changes",
  },
  {
    name: "Package.json dependency update",
    files: [
      { file: "package.json", insertions: 2, deletions: 2, binary: false },
      { file: "bun.lock", insertions: 50, deletions: 30, binary: false },
    ],
    expectedType: "chore",
    expectedScope: "deps",
    description: "Should detect dependency updates",
  },
  {
    name: "CSS styling changes",
    files: [
      {
        file: "src/styles/main.css",
        insertions: 15,
        deletions: 8,
        binary: false,
      },
      {
        file: "src/components/Button.scss",
        insertions: 10,
        deletions: 2,
        binary: false,
      },
    ],
    expectedType: "style",
    description: "Should detect styling changes",
  },
  {
    name: "Configuration files",
    files: [
      {
        file: ".github/workflows/ci.yml",
        insertions: 20,
        deletions: 5,
        binary: false,
      },
      { file: "tsconfig.json", insertions: 3, deletions: 1, binary: false },
    ],
    expectedType: "chore",
    expectedScope: "config",
    description: "Should detect configuration changes",
  },
  {
    name: "Mixed changes - refactoring",
    files: [
      {
        file: "src/auth/login.ts",
        insertions: 25,
        deletions: 30,
        binary: false,
      },
      {
        file: "src/auth/register.ts",
        insertions: 20,
        deletions: 25,
        binary: false,
      },
    ],
    expectedType: "refactor",
    expectedScope: "auth",
    description: "Should detect refactoring when modifications are balanced",
  },
];

// Assertion helpers
export function assertCommitMessage(
  message: string,
  expectedType: string,
  expectedScope?: string,
): void {
  const conventionalPattern = /^(\w+)(\([\w-]+\))?: .+/;
  const match = message.match(conventionalPattern);

  if (!match) {
    throw new Error(
      `Commit message "${message}" does not follow conventional format`,
    );
  }

  const actualType = match[1];
  const actualScope = match[2]?.replace(/[()]/g, "");

  if (actualType !== expectedType) {
    throw new Error(`Expected type "${expectedType}", got "${actualType}"`);
  }

  if (expectedScope && actualScope !== expectedScope) {
    throw new Error(
      `Expected scope "${expectedScope}", got "${actualScope || "none"}"`,
    );
  }
}

export function assertMessageLength(
  message: string,
  maxLength: number = 50,
): void {
  if (message.length > maxLength) {
    console.warn(
      `Commit message is longer than ${maxLength} characters: ${message.length}`,
    );
  }
}

export function assertImperativeMood(message: string): void {
  const description = message.split(": ")[1]?.toLowerCase() || "";

  // Common non-imperative patterns
  const nonImperativePatterns = [
    /^(added|adds|adding)/,
    /^(fixed|fixes|fixing)/,
    /^(updated|updates|updating)/,
    /^(removed|removes|removing)/,
    /^(changed|changes|changing)/,
  ];

  const hasNonImperative = nonImperativePatterns.some((pattern) =>
    pattern.test(description),
  );

  if (hasNonImperative) {
    console.warn(
      `Commit message may not be in imperative mood: "${description}"`,
    );
  }
}

// Test runner utility
export async function runTestScenario(
  scenario: TestScenario,
  testFunction: (repoPath: string) => Promise<any>,
): Promise<void> {
  console.log(`\n🧪 Running test: ${scenario.name}`);

  const mockRepo = new MockGitRepo();

  try {
    await mockRepo.setup();

    // Create the scenario files
    for (const fileChange of scenario.files) {
      const content = generateMockContent(fileChange);
      await mockRepo.addFile(fileChange.file, content);
    }

    // Ensure all files are properly staged
    const git = simpleGit(mockRepo.path);
    await git.add(".");

    // Run the test
    const result = await testFunction(mockRepo.path);

    // Basic assertions
    if (result && result.suggestions && result.suggestions.length > 0) {
      const primarySuggestion = result.suggestions[0];

      try {
        assertCommitMessage(
          primarySuggestion.message,
          scenario.expectedType,
          scenario.expectedScope,
        );
        assertMessageLength(primarySuggestion.message);
        assertImperativeMood(primarySuggestion.message);

        console.log(`✅ ${scenario.description}`);
        console.log(`   Generated: "${primarySuggestion.message}"`);
        console.log(
          `   Type: ${primarySuggestion.type}, Scope: ${primarySuggestion.scope || "none"}`,
        );
      } catch (assertionError) {
        console.log(`❌ ${scenario.description}`);
        console.log(
          `   Error: ${assertionError instanceof Error ? assertionError.message : "Unknown error"}`,
        );
        console.log(`   Generated: "${primarySuggestion.message}"`);
      }
    } else {
      console.log(`❌ ${scenario.description}`);
      console.log(`   Error: No suggestions generated`);
    }
  } catch (error) {
    console.log(`❌ ${scenario.description}`);
    console.log(
      `   Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    mockRepo.cleanup();
  }
}

// Helper to generate realistic file content based on file type
function generateMockContent(fileChange: MockFileChange): string {
  const ext = fileChange.file.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "ts":
    case "js":
      return `
// ${fileChange.file}
export function ${fileChange.file
        .split("/")
        .pop()
        ?.replace(/\.[^/.]+$/, "")}Function() {
  // Implementation here
  return true;
}

export default class ${fileChange.file
        .split("/")
        .pop()
        ?.replace(/\.[^/.]+$/, "")
        .replace(/^\w/, (c) => c.toUpperCase())} {
  constructor() {
    // Constructor implementation
  }

  public method(): void {
    // Method implementation
  }
}
`;

    case "md":
      return `
# ${fileChange.file.replace(/\.[^/.]+$/, "").replace(/^\w/, (c) => c.toUpperCase())}

This is documentation content for ${fileChange.file}.

## Features

- Feature 1
- Feature 2
- Feature 3

## Usage

\`\`\`typescript
// Example usage
import { example } from './example';
\`\`\`
`;

    case "css":
    case "scss":
      return `
/* ${fileChange.file} */
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
}

.button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}
`;

    case "json":
      if (fileChange.file.includes("package")) {
        return `{
  "name": "test-project",
  "version": "1.0.0",
  "dependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0"
  }
}`;
      }
      return `{
  "config": "value",
  "setting": true,
  "number": 42
}`;

    case "yml":
    case "yaml":
      return `
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
`;

    default:
      return `// Content for ${fileChange.file}\n// Generated mock content\n`;
  }
}

// Export commonly used constants
export const CONVENTIONAL_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "test",
  "chore",
];

export const COMMON_SCOPES = [
  "api",
  "ui",
  "auth",
  "db",
  "config",
  "deps",
  "utils",
  "components",
];
