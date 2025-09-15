#!/usr/bin/env bun
import { generateCommitMessage } from "../tools";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { simpleGit } from "simple-git";

// Simple test runner
class SimpleTestRunner {
  private passed = 0;
  private failed = 0;

  async test(name: string, testFn: () => Promise<void>): Promise<void> {
    try {
      console.log(`🧪 Testing: ${name}`);
      await testFn();
      console.log(`✅ PASS: ${name}`);
      this.passed++;
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.log(
        `   Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      this.failed++;
    }
  }

  summary(): void {
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

async function createTempRepo(): Promise<{
  path: string;
  cleanup: () => void;
}> {
  const tempPath = join("/tmp", `simple-test-${Date.now()}`);

  // Create directory
  mkdirSync(tempPath, { recursive: true });

  // Initialize git
  const git = simpleGit(tempPath);
  await git.init();
  await git.addConfig("user.name", "Test User");
  await git.addConfig("user.email", "test@example.com");

  // Initial commit
  writeFileSync(join(tempPath, "README.md"), "# Test\n");
  await git.add("README.md");
  await git.commit("Initial commit");

  return {
    path: tempPath,
    cleanup: () => {
      if (existsSync(tempPath)) {
        rmSync(tempPath, { recursive: true, force: true });
      }
    },
  };
}

async function main() {
  const runner = new SimpleTestRunner();

  console.log("🚀 Starting Simple Commit Message Generation Tests\n");

  // Test 1: No changes
  await runner.test("No changes detected", async () => {
    const { path, cleanup } = await createTempRepo();

    try {
      const result = await generateCommitMessage({
        rootDir: path,
        style: "conventional",
        maxSuggestions: 1,
        includeScope: true,
      });

      if (!result.suggestions[0]?.message.includes("No changes")) {
        throw new Error(
          `Expected no changes message, got: ${result.suggestions[0]?.message}`,
        );
      }

      if (result.summary.filesChanged !== 0) {
        throw new Error(
          `Expected 0 files changed, got: ${result.summary.filesChanged}`,
        );
      }
    } finally {
      cleanup();
    }
  });

  // Test 2: Simple TypeScript file addition
  await runner.test("TypeScript file addition", async () => {
    const { path, cleanup } = await createTempRepo();

    try {
      // Add a TypeScript file
      const srcDir = join(path, "src/utils");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(path, "src/utils/helper.ts"),
        "export const helper = () => true;",
      );

      const git = simpleGit(path);
      await git.add("src/utils/helper.ts");

      const result = await generateCommitMessage({
        rootDir: path,
        style: "conventional",
        maxSuggestions: 1,
        includeScope: true,
      });

      const message = result.suggestions[0]?.message;
      if (!message) {
        throw new Error("No commit message generated");
      }

      // Should be a feat commit
      if (!message.startsWith("feat")) {
        throw new Error(`Expected feat commit, got: ${message}`);
      }

      // Should have usage examples
      if (result.usage.examples.length === 0) {
        throw new Error("No usage examples provided");
      }
    } finally {
      cleanup();
    }
  });

  // Test 3: Documentation update
  await runner.test("Documentation update", async () => {
    const { path, cleanup } = await createTempRepo();

    try {
      // Update README
      writeFileSync(
        join(path, "README.md"),
        "# Test\n\nUpdated documentation\n",
      );

      // Add a new docs file too
      const docsDir = join(path, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(
        join(path, "docs/guide.md"),
        "# Guide\n\nNew documentation\n",
      );

      const git = simpleGit(path);
      await git.add(".");

      const result = await generateCommitMessage({
        rootDir: path,
        style: "conventional",
        maxSuggestions: 1,
        includeScope: true,
      });

      const message = result.suggestions[0]?.message;
      if (!message) {
        throw new Error("No commit message generated");
      }

      // Should be a docs commit
      if (!message.startsWith("docs")) {
        throw new Error(`Expected docs commit, got: ${message}`);
      }
    } finally {
      cleanup();
    }
  });

  // Test 4: Multiple suggestions
  await runner.test("Multiple suggestions", async () => {
    const { path, cleanup } = await createTempRepo();

    try {
      const srcDir = join(path, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(path, "src/feature.ts"),
        "export const feature = true;",
      );

      const git = simpleGit(path);
      await git.add(".");

      const result = await generateCommitMessage({
        rootDir: path,
        style: "conventional",
        maxSuggestions: 3,
        includeScope: true,
      });

      if (result.suggestions.length !== 3) {
        throw new Error(
          `Expected 3 suggestions, got: ${result.suggestions.length}`,
        );
      }

      // First should be primary
      if (result.suggestions[0]?.priority !== "primary") {
        throw new Error("First suggestion should be primary");
      }

      // Others should be alternative
      if (result.suggestions[1]?.priority !== "alternative") {
        throw new Error("Second suggestion should be alternative");
      }
    } finally {
      cleanup();
    }
  });

  // Test 5: Different styles
  await runner.test("Different commit styles", async () => {
    const { path, cleanup } = await createTempRepo();

    try {
      const srcDir = join(path, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(path, "src/test.js"), 'console.log("test");');

      const git = simpleGit(path);
      await git.add(".");

      const styles = ["conventional", "semantic", "descriptive"] as const;

      for (const style of styles) {
        const result = await generateCommitMessage({
          rootDir: path,
          style,
          maxSuggestions: 1,
          includeScope: true,
        });

        const message = result.suggestions[0]?.message;
        if (!message) {
          throw new Error(`No message generated for ${style} style`);
        }

        // Verify style-specific formatting
        switch (style) {
          case "conventional":
            if (!/^[a-z]+(\([^)]+\))?: /.test(message)) {
              throw new Error(`Invalid conventional format: ${message}`);
            }
            break;
          case "semantic":
            if (!/^(\[?[A-Z]+\]?|[A-Z]+): /.test(message)) {
              throw new Error(`Invalid semantic format: ${message}`);
            }
            break;
          case "descriptive":
            if (!/^[A-Z]/.test(message) || message.includes(":")) {
              throw new Error(`Invalid descriptive format: ${message}`);
            }
            break;
        }
      }
    } finally {
      cleanup();
    }
  });

  // Test 6: Error handling - invalid directory
  await runner.test("Error handling - invalid directory", async () => {
    const result = await generateCommitMessage({
      rootDir: "/nonexistent/path",
      style: "conventional",
      maxSuggestions: 1,
      includeScope: true,
    });

    if (!result.suggestions[0]?.rationale.includes("does not exist")) {
      throw new Error("Should handle invalid directory gracefully");
    }

    if (result.suggestions[0]?.type !== "error") {
      throw new Error("Should return error type for invalid directory");
    }
  });

  runner.summary();
}

// Run tests
if (import.meta.main) {
  main().catch((error) => {
    console.error("Test runner failed:", error);
    process.exit(1);
  });
}
