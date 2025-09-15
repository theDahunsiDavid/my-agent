#!/usr/bin/env bun
import { generateCommitMessage } from "../tools";
import {
  testScenarios,
  runTestScenario,
  MockGitRepo,
  assertCommitMessage,
  assertMessageLength,
  assertImperativeMood,
  CONVENTIONAL_TYPES,
} from "./test-utils";

// Test configuration
const TEST_CONFIG = {
  maxSuggestions: 3,
  styles: ["conventional", "semantic", "descriptive"] as const,
  includeScope: true,
  timeout: 30000, // 30 seconds timeout per test
};

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  suggestions?: any[];
}

class TestRunner {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log("🚀 Starting Commit Message Generation Tool Tests\n");
    console.log("=".repeat(60));

    // Test basic functionality with predefined scenarios
    await this.runScenarioTests();

    // Test edge cases
    await this.runEdgeCaseTests();

    // Test error conditions
    await this.runErrorTests();

    // Test different styles
    await this.runStyleTests();

    // Print summary
    this.printSummary();
  }

  async runScenarioTests(): Promise<void> {
    console.log("\n📋 Running Scenario Tests");
    console.log("-".repeat(40));

    for (const scenario of testScenarios) {
      const startTime = Date.now();

      try {
        await runTestScenario(scenario, async (repoPath: string) => {
          const result = await generateCommitMessage({
            rootDir: repoPath,
            style: "conventional",
            maxSuggestions: TEST_CONFIG.maxSuggestions,
            includeScope: TEST_CONFIG.includeScope,
          });

          return result;
        });

        this.results.push({
          name: scenario.name,
          passed: true,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        this.results.push({
          name: scenario.name,
          passed: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - startTime,
        });
      }
    }
  }

  async runEdgeCaseTests(): Promise<void> {
    console.log("\n🎯 Running Edge Case Tests");
    console.log("-".repeat(40));

    const edgeCases = [
      {
        name: "Empty repository (no changes)",
        test: async () => {
          const mockRepo = new MockGitRepo();
          try {
            await mockRepo.setup();

            const result = await generateCommitMessage({
              rootDir: mockRepo.path,
              style: "conventional",
              maxSuggestions: 1,
              includeScope: true,
            });

            if (!result.suggestions[0]?.message.includes("No changes")) {
              throw new Error("Should detect no changes");
            }

            return result;
          } finally {
            mockRepo.cleanup();
          }
        },
      },
      {
        name: "Only excluded files changed",
        test: async () => {
          const mockRepo = new MockGitRepo();
          try {
            await mockRepo.setup();
            await mockRepo.addFile("dist/bundle.js", "// Generated bundle");
            await mockRepo.addFile("bun.lock", "# Lock file content");

            const result = await generateCommitMessage({
              rootDir: mockRepo.path,
              style: "conventional",
              maxSuggestions: 1,
              includeScope: true,
            });

            if (!result.suggestions[0]?.message.includes("excluded")) {
              throw new Error("Should detect only excluded files");
            }

            return result;
          } finally {
            mockRepo.cleanup();
          }
        },
      },
      {
        name: "Very long file names",
        test: async () => {
          const mockRepo = new MockGitRepo();
          try {
            await mockRepo.setup();
            const longFileName =
              "src/very/deep/nested/directory/structure/with/a/really/long/file/name/that/tests/path/handling.ts";
            await mockRepo.addFile(longFileName, "export const test = true;");

            const result = await generateCommitMessage({
              rootDir: mockRepo.path,
              style: "conventional",
              maxSuggestions: 1,
              includeScope: true,
            });

            if (!result.suggestions[0]?.message) {
              throw new Error("Should generate message for long file paths");
            }

            return result;
          } finally {
            mockRepo.cleanup();
          }
        },
      },
      {
        name: "Maximum suggestions limit",
        test: async () => {
          const mockRepo = new MockGitRepo();
          try {
            await mockRepo.setup();
            await mockRepo.addFile("src/test.ts", "export const test = true;");

            const result = await generateCommitMessage({
              rootDir: mockRepo.path,
              style: "conventional",
              maxSuggestions: 5,
              includeScope: true,
            });

            if (result.suggestions.length > 5) {
              throw new Error(
                `Should not exceed max suggestions: got ${result.suggestions.length}`,
              );
            }

            return result;
          } finally {
            mockRepo.cleanup();
          }
        },
      },
    ];

    for (const edgeCase of edgeCases) {
      const startTime = Date.now();

      try {
        console.log(`  Testing: ${edgeCase.name}`);
        const result = await edgeCase.test();

        console.log(`  ✅ Passed: ${edgeCase.name}`);
        this.results.push({
          name: `Edge Case: ${edgeCase.name}`,
          passed: true,
          duration: Date.now() - startTime,
          suggestions: result.suggestions,
        });
      } catch (error) {
        console.log(`  ❌ Failed: ${edgeCase.name}`);
        console.log(
          `     Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );

        this.results.push({
          name: `Edge Case: ${edgeCase.name}`,
          passed: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - startTime,
        });
      }
    }
  }

  async runErrorTests(): Promise<void> {
    console.log("\n⚠️  Running Error Handling Tests");
    console.log("-".repeat(40));

    const errorTests = [
      {
        name: "Invalid directory path",
        test: async () => {
          const result = await generateCommitMessage({
            rootDir: "/nonexistent/directory/path",
            style: "conventional",
            maxSuggestions: 1,
            includeScope: true,
          });

          if (!result.suggestions[0]?.rationale.includes("does not exist")) {
            throw new Error("Should handle non-existent directory");
          }

          return result;
        },
      },
      {
        name: "Non-Git repository",
        test: async () => {
          const mockRepo = new MockGitRepo();
          try {
            // Create directory but don't initialize git
            const { mkdirSync } = await import("fs");
            mkdirSync(mockRepo.path, { recursive: true });

            const result = await generateCommitMessage({
              rootDir: mockRepo.path,
              style: "conventional",
              maxSuggestions: 1,
              includeScope: true,
            });

            if (
              !result.suggestions[0]?.rationale.includes("not a Git repository")
            ) {
              throw new Error("Should detect non-Git repository");
            }

            return result;
          } finally {
            mockRepo.cleanup();
          }
        },
      },
      {
        name: "Invalid maxSuggestions",
        test: async () => {
          const mockRepo = new MockGitRepo();
          try {
            await mockRepo.setup();

            const result = await generateCommitMessage({
              rootDir: mockRepo.path,
              style: "conventional",
              maxSuggestions: 0, // Invalid value
              includeScope: true,
            });

            if (
              !result.suggestions[0]?.rationale.includes(
                "must be between 1 and 5",
              )
            ) {
              throw new Error("Should validate maxSuggestions parameter");
            }

            return result;
          } finally {
            mockRepo.cleanup();
          }
        },
      },
    ];

    for (const errorTest of errorTests) {
      const startTime = Date.now();

      try {
        console.log(`  Testing: ${errorTest.name}`);
        const result = await errorTest.test();

        console.log(`  ✅ Passed: ${errorTest.name}`);
        this.results.push({
          name: `Error Test: ${errorTest.name}`,
          passed: true,
          duration: Date.now() - startTime,
          suggestions: result.suggestions,
        });
      } catch (error) {
        console.log(`  ❌ Failed: ${errorTest.name}`);
        console.log(
          `     Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );

        this.results.push({
          name: `Error Test: ${errorTest.name}`,
          passed: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - startTime,
        });
      }
    }
  }

  async runStyleTests(): Promise<void> {
    console.log("\n🎨 Running Style Format Tests");
    console.log("-".repeat(40));

    for (const style of TEST_CONFIG.styles) {
      const startTime = Date.now();

      try {
        console.log(`  Testing style: ${style}`);

        const mockRepo = new MockGitRepo();
        try {
          await mockRepo.setup();
          await mockRepo.addFile(
            "src/feature.ts",
            "export const newFeature = true;",
          );

          const result = await generateCommitMessage({
            rootDir: mockRepo.path,
            style: style,
            maxSuggestions: 2,
            includeScope: true,
          });

          // Validate style-specific format
          const primaryMessage = result.suggestions[0]?.message;
          if (!primaryMessage) {
            throw new Error("No primary message generated");
          }

          switch (style) {
            case "conventional":
              if (!/^[a-z]+(\([^)]+\))?: .+/.test(primaryMessage)) {
                throw new Error(
                  `Conventional format invalid: ${primaryMessage}`,
                );
              }
              break;
            case "semantic":
              if (!/^(\[?[A-Z]+\]?|[A-Z]+): .+/.test(primaryMessage)) {
                throw new Error(`Semantic format invalid: ${primaryMessage}`);
              }
              break;
            case "descriptive":
              if (!/^[A-Z][^:]*[^:]$/.test(primaryMessage)) {
                throw new Error(
                  `Descriptive format invalid: ${primaryMessage}`,
                );
              }
              break;
          }

          console.log(`    ✅ ${style}: "${primaryMessage}"`);

          this.results.push({
            name: `Style Test: ${style}`,
            passed: true,
            duration: Date.now() - startTime,
            suggestions: result.suggestions,
          });
        } finally {
          mockRepo.cleanup();
        }
      } catch (error) {
        console.log(
          `    ❌ ${style}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );

        this.results.push({
          name: `Style Test: ${style}`,
          passed: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - startTime,
        });
      }
    }
  }

  printSummary(): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(60));

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const total = this.results.length;
    const avgDuration =
      this.results.reduce((acc, r) => acc + r.duration, 0) / total;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ${failed > 0 ? "❌" : ""}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log(`Average Duration: ${avgDuration.toFixed(0)}ms`);

    if (failed > 0) {
      console.log("\n❌ FAILED TESTS:");
      console.log("-".repeat(40));
      this.results
        .filter((r) => !r.passed)
        .forEach((result) => {
          console.log(`  • ${result.name}`);
          console.log(`    Error: ${result.error}`);
          console.log(`    Duration: ${result.duration}ms`);
        });
    }

    console.log("\n" + "=".repeat(60));

    if (failed === 0) {
      console.log("🎉 All tests passed!");
      process.exit(0);
    } else {
      console.log("💥 Some tests failed. Check the output above for details.");
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const runner = new TestRunner();

  try {
    await runner.runAllTests();
  } catch (error) {
    console.error("\n💥 Test runner failed:", error);
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on("SIGINT", () => {
  console.log("\n\n⚠️  Test execution interrupted by user.");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n💥 Unhandled Promise Rejection:", reason);
  process.exit(1);
});

// Run tests if this file is executed directly
if (import.meta.main) {
  main();
}

export { TestRunner };
