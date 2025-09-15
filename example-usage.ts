#!/usr/bin/env bun

import { stepCountIs, streamText } from "ai";
import { google } from "@ai-sdk/google";
import { SYSTEM_PROMPT } from "./prompts";
import {
  getFileChangesInDirectoryTool,
  generateCommitMessageTool,
} from "./tools";

const codeReviewAgent = async (prompt: string) => {
  const result = streamText({
    model: google("models/gemini-2.5-flash"),
    prompt,
    system: SYSTEM_PROMPT,
    tools: {
      getFileChangesInDirectoryTool: getFileChangesInDirectoryTool,
      generateCommitMessageTool: generateCommitMessageTool,
    },
    stopWhen: stepCountIs(10),
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
};

// 🎯 USAGE EXAMPLES - Uncomment the one you want to test

async function main() {
  console.log("🚀 Starting Code Review Agent Demo\n");
  console.log("=" .repeat(60));

  // ===============================================
  // Example 1: Combined Review + Commit Messages
  // ===============================================
  await codeReviewAgent(
    "Review the code changes in '.' directory and provide detailed feedback, then generate 3 commit message suggestions using conventional style with scope"
  );

  // ===============================================
  // Example 2: Code Review Only
  // ===============================================
  // await codeReviewAgent(
  //   "Review the code changes in '.' directory, make your reviews and suggestions file by file. Focus on code quality, security, and best practices."
  // );

  // ===============================================
  // Example 3: Commit Messages Only (Conventional)
  // ===============================================
  // await codeReviewAgent(
  //   "Generate 5 commit message suggestions for changes in '.' directory using conventional format with scope included"
  // );

  // ===============================================
  // Example 4: Commit Messages (Semantic Style)
  // ===============================================
  // await codeReviewAgent(
  //   "Generate 3 commit message suggestions for changes in '.' directory using semantic style"
  // );

  // ===============================================
  // Example 5: Commit Messages (Descriptive Style)
  // ===============================================
  // await codeReviewAgent(
  //   "Generate 3 commit message suggestions for changes in '.' directory using descriptive style without scope"
  // );

  // ===============================================
  // Example 6: Specific Directory Analysis
  // ===============================================
  // await codeReviewAgent(
  //   "Analyze the changes in './src' directory and provide both code review feedback and commit message suggestions"
  // );

  // ===============================================
  // Example 7: Focus on Security Review
  // ===============================================
  // await codeReviewAgent(
  //   "Review the code changes in '.' directory with special focus on security vulnerabilities, authentication, and data validation"
  // );

  // ===============================================
  // Example 8: Performance-Focused Review
  // ===============================================
  // await codeReviewAgent(
  //   "Review the code changes in '.' directory focusing on performance optimizations, memory usage, and scalability concerns"
  // );

  // ===============================================
  // Example 9: Testing and Documentation Review
  // ===============================================
  // await codeReviewAgent(
  //   "Review the code changes in '.' directory focusing on test coverage, documentation quality, and maintainability"
  // );

  // ===============================================
  // Example 10: New Feature Analysis
  // ===============================================
  // await codeReviewAgent(
  //   "Analyze the new feature implementation in '.' directory, review the code quality, and suggest appropriate commit messages for this feature addition"
  // );
}

// Error handling wrapper
async function runExample() {
  try {
    await main();
    console.log("\n" + "=".repeat(60));
    console.log("✅ Agent execution completed successfully!");
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ Error running the agent:");

    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      // Provide helpful hints for common errors
      if (error.message.includes('API key') || error.message.includes('401')) {
        console.error("\n💡 Hint: Make sure you have set your Google AI API key:");
        console.error("   export GOOGLE_GENERATIVE_AI_API_KEY='your-key-here'");
        console.error("   Get your key at: https://aistudio.google.com/app/apikey");
      }

      if (error.message.includes('network') || error.message.includes('fetch')) {
        console.error("\n💡 Hint: Check your internet connection and API key permissions");
      }

      if (error.message.includes('git') || error.message.includes('repository')) {
        console.error("\n💡 Hint: Make sure you're in a git repository with some staged changes:");
        console.error("   git add .");
        console.error("   bun run example-usage.ts");
      }
    } else {
      console.error(`   ${String(error)}`);
    }

    console.error("\n🔧 Troubleshooting:");
    console.error("   1. Verify your API key is set correctly");
    console.error("   2. Check you have staged changes: git status");
    console.error("   3. Ensure you're in a git repository");
    console.error("   4. Try running tests first: bun run test");

    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Execution interrupted by user. Goodbye! 👋');
  process.exit(0);
});

// Run the example
if (import.meta.main) {
  console.log("🤖 Code Review Agent - Example Usage");
  console.log("📝 Edit this file to try different examples\n");

  // Check for API key
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.warn("⚠️  Warning: No Google AI API key found in environment variables");
    console.warn("   Set GOOGLE_GENERATIVE_AI_API_KEY to use the AI features");
    console.warn("   You can still run tests with: bun run test\n");
  }

  // Check git status
  const { execSync } = require('child_process');
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (!gitStatus.trim()) {
      console.warn("⚠️  No staged changes found. The agent works best with staged changes.");
      console.warn("   Try: git add . && bun run example-usage.ts\n");
    } else {
      console.log("✅ Found staged changes - ready to analyze!\n");
    }
  } catch (error) {
    console.warn("⚠️  Not in a git repository. Some features may not work.\n");
  }

  runExample();
}
