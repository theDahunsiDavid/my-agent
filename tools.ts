import { z } from "zod";
import { tool } from "ai";
import { simpleGit } from "simple-git";
import { existsSync } from "fs";
import { resolve } from "path";

const fileChange = z.object({
  rootDir: z.string().min(1).describe("The root directory"),
});

type FileChange = z.infer<typeof fileChange>;

const commitMessageParams = z.object({
  rootDir: z.string().min(1).describe("The root directory"),
  style: z
    .enum(["conventional", "semantic", "descriptive"])
    .optional()
    .default("conventional")
    .describe("Commit message style"),
  maxSuggestions: z
    .number()
    .min(1)
    .max(5)
    .optional()
    .default(3)
    .describe("Maximum number of suggestions to generate"),
  includeScope: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to include scope in conventional commits"),
});

type CommitMessageParams = z.infer<typeof commitMessageParams>;

type CommitMessageSuggestion = {
  message: string;
  type: string;
  scope?: string;
  rationale: string;
  style: "conventional" | "semantic" | "descriptive";
  example?: string;
  priority: "primary" | "alternative";
  length: number;
};

type CommitMessageResponse = {
  suggestions: CommitMessageSuggestion[];
  summary: {
    totalSuggestions: number;
    filesChanged: number;
    changeTypes: string[];
    recommendedStyle: string;
    primarySuggestion: string;
  };
  usage: {
    howToUse: string;
    examples: string[];
  };
};

const excludeFiles = ["dist", "bun.lock", ".DS_Store", "node_modules"];

// Error types for better error handling
class GitOperationError extends Error {
  constructor(
    message: string,
    public override cause?: Error,
  ) {
    super(message);
    this.name = "GitOperationError";
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Helper function to validate Git repository
async function validateGitRepository(rootDir: string): Promise<void> {
  const resolvedPath = resolve(rootDir);

  if (!existsSync(resolvedPath)) {
    throw new ValidationError(`Directory does not exist: ${rootDir}`);
  }

  try {
    const git = simpleGit(rootDir);
    await git.checkIsRepo();
  } catch (error) {
    throw new ValidationError(
      `Directory is not a Git repository: ${rootDir}. Initialize with 'git init' first.`,
    );
  }
}

// Helper function to safely get Git status
async function safeGetGitStatus(git: any, rootDir: string) {
  try {
    const [status, summary] = await Promise.all([
      git.status(),
      git.diffSummary(["--cached"]), // Use --cached to get staged changes
    ]);
    return { status, summary };
  } catch (error) {
    throw new GitOperationError(
      `Failed to get Git status for ${rootDir}: ${error instanceof Error ? error.message : "Unknown error"}`,
      error instanceof Error ? error : undefined,
    );
  }
}

async function getFileChangesInDirectory({ rootDir }: FileChange) {
  try {
    // Validate inputs
    if (!rootDir || typeof rootDir !== "string") {
      throw new ValidationError("Root directory must be a non-empty string");
    }

    // Validate Git repository
    await validateGitRepository(rootDir);

    const git = simpleGit(rootDir);

    // Safely get diff summary (check both staged and unstaged changes)
    let summary;
    try {
      // First try to get staged changes
      summary = await git.diffSummary(["--cached"]);

      // If no staged changes, try unstaged changes
      if (summary.files.length === 0) {
        summary = await git.diffSummary();
      }
    } catch (error) {
      throw new GitOperationError(
        `Failed to get diff summary for ${rootDir}: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : undefined,
      );
    }

    const diffs: { file: string; diff: string }[] = [];

    if (!summary || !summary.files) {
      return diffs; // Return empty array if no files
    }

    for (const file of summary.files) {
      try {
        if (!file || !file.file) {
          console.warn("Invalid file object found, skipping:", file);
          continue;
        }

        // Enhanced file filtering
        if (excludeFiles.some((excluded) => file.file.includes(excluded))) {
          continue;
        }

        // Get diff with error handling
        let diff;
        try {
          diff = await git.diff(["--", file.file]);
        } catch (diffError) {
          console.warn(`Failed to get diff for file ${file.file}:`, diffError);
          diff = `Error: Could not retrieve diff for ${file.file}`;
        }

        diffs.push({ file: file.file, diff });
      } catch (fileError) {
        console.warn(
          `Error processing file ${file?.file || "unknown"}:`,
          fileError,
        );
        // Continue with other files instead of failing completely
      }
    }

    return diffs;
  } catch (error) {
    // Handle validation and Git operation errors
    if (
      error instanceof ValidationError ||
      error instanceof GitOperationError
    ) {
      console.error("Error in getFileChangesInDirectory:", error.message);
      throw error; // Re-throw known errors
    }

    // Handle unexpected errors
    console.error("Unexpected error in getFileChangesInDirectory:", error);
    throw new GitOperationError(
      `Unexpected error while getting file changes: ${error instanceof Error ? error.message : "Unknown error"}`,
      error instanceof Error ? error : undefined,
    );
  }
}

async function generateCommitMessage({
  rootDir,
  style = "conventional",
  maxSuggestions = 3,
  includeScope = true,
}: CommitMessageParams): Promise<CommitMessageResponse> {
  try {
    // Validate inputs
    if (!rootDir || typeof rootDir !== "string") {
      throw new ValidationError("Root directory must be a non-empty string");
    }

    if (maxSuggestions < 1 || maxSuggestions > 5) {
      throw new ValidationError("Maximum suggestions must be between 1 and 5");
    }

    // Validate Git repository
    await validateGitRepository(rootDir);

    const git = simpleGit(rootDir);

    // Safely get Git status and diff summary (including staged changes)
    const { status, summary } = await safeGetGitStatus(git, rootDir);

    if (summary.files.length === 0) {
      // Check if files are staged
      if (
        status.staged.length === 0 &&
        status.modified.length === 0 &&
        status.not_added.length === 0 &&
        status.deleted.length === 0
      ) {
        return {
          suggestions: [
            {
              message: "No changes detected",
              type: "none",
              rationale:
                "No file changes found in the repository. Working directory is clean.",
              style,
              priority: "primary" as const,
              length: 19,
            },
          ],
          summary: {
            totalSuggestions: 1,
            filesChanged: 0,
            changeTypes: [],
            recommendedStyle: style,
            primarySuggestion: "No changes detected",
          },
          usage: {
            howToUse:
              "Make some changes to your files and stage them with 'git add .' before generating commit messages",
            examples: [
              "# Make some changes first",
              "git add .",
              "# Then generate commit messages",
            ],
          },
        };
      } else {
        return {
          suggestions: [
            {
              message: "No staged changes detected",
              type: "none",
              rationale:
                "Files have been modified but not staged for commit. Use 'git add' to stage changes first.",
              style,
              priority: "primary" as const,
              length: 27,
            },
          ],
          summary: {
            totalSuggestions: 1,
            filesChanged:
              status.modified.length +
              status.not_added.length +
              status.deleted.length,
            changeTypes: ["unstaged"],
            recommendedStyle: style,
            primarySuggestion: "No staged changes detected",
          },
          usage: {
            howToUse: "Stage your changes first, then generate commit messages",
            examples: [
              "git add .",
              "# Then generate commit messages",
              `git add ${status.not_added[0] || status.modified[0] || "specific-file.txt"}`,
            ],
          },
        };
      }
    }

    const suggestions: CommitMessageSuggestion[] = [];
    const changedFiles = summary.files.filter(
      (file: any) =>
        !excludeFiles.some((excluded) => file.file.includes(excluded)),
    );

    if (changedFiles.length === 0) {
      return {
        suggestions: [
          {
            message: "Only excluded files changed",
            type: "chore",
            rationale:
              "All changes are in excluded files (build artifacts, dependencies, etc.)",
            style,
            priority: "primary" as const,
            length: 26,
          },
        ],
        summary: {
          totalSuggestions: 1,
          filesChanged: summary.files.length,
          changeTypes: ["excluded"],
          recommendedStyle: style,
          primarySuggestion: "Only excluded files changed",
        },
        usage: {
          howToUse: "Consider if these changes should be committed or excluded",
          examples: [
            "# If you want to commit these changes:",
            `git commit -m "Only excluded files changed"`,
            "# Or add them to .gitignore",
          ],
        },
      };
    }

    // Analyze changes to determine commit type and scope
    const analysis = await analyzeChanges(git, changedFiles);

    // Generate suggestions based on style
    for (let i = 0; i < maxSuggestions; i++) {
      try {
        const suggestion = await generateSuggestion(
          analysis,
          style,
          includeScope,
          i,
        );
        suggestions.push(suggestion);
      } catch (error) {
        console.warn(`Failed to generate suggestion ${i + 1}:`, error);
        // Continue with other suggestions
      }
    }

    if (suggestions.length === 0) {
      throw new GitOperationError(
        "Failed to generate any commit message suggestions",
      );
    }

    // Create formatted response with summary and usage information
    const primarySuggestion = suggestions[0]?.message || "Update code";
    const changeTypesList: string[] = Array.from(
      new Set(
        changedFiles.map((f: any) => {
          // Type guard to check if file has insertions/deletions properties
          if ("insertions" in f && "deletions" in f) {
            if (f.insertions > 0 && f.deletions === 0) return "additions";
            if (f.deletions > 0 && f.insertions === 0) return "deletions";
            return "modifications";
          }
          // Fallback for binary files or other types
          return "modifications";
        }),
      ),
    );

    return {
      suggestions,
      summary: {
        totalSuggestions: suggestions.length,
        filesChanged: changedFiles.length,
        changeTypes: changeTypesList,
        recommendedStyle: style,
        primarySuggestion,
      },
      usage: {
        howToUse: `Copy one of the suggested commit messages and use: git commit -m "${primarySuggestion}"`,
        examples: [
          `git commit -m "${primarySuggestion}"`,
          `git add . && git commit -m "${primarySuggestion}"`,
          ...(suggestions.length > 1
            ? [`git commit -m "${suggestions[1]?.message}"`]
            : []),
        ],
      },
    };
  } catch (error) {
    // Handle different error types appropriately
    if (error instanceof ValidationError) {
      return {
        suggestions: [
          {
            message: "Validation Error",
            type: "error",
            rationale: error.message,
            style,
            priority: "primary" as const,
            length: 16,
          },
        ],
        summary: {
          totalSuggestions: 1,
          filesChanged: 0,
          changeTypes: ["error"],
          recommendedStyle: style,
          primarySuggestion: "Validation Error",
        },
        usage: {
          howToUse: "Fix the validation error and try again",
          examples: ["# Fix the issue mentioned above and retry"],
        },
      };
    }

    if (error instanceof GitOperationError) {
      return {
        suggestions: [
          {
            message: "Git Operation Failed",
            type: "error",
            rationale: error.message,
            style,
            priority: "primary" as const,
            length: 20,
          },
        ],
        summary: {
          totalSuggestions: 1,
          filesChanged: 0,
          changeTypes: ["error"],
          recommendedStyle: style,
          primarySuggestion: "Git Operation Failed",
        },
        usage: {
          howToUse: "Check Git repository status and try again",
          examples: [
            "git status",
            "git log --oneline -5",
            "# Fix any Git issues and retry",
          ],
        },
      };
    }

    // Unknown error - rethrow for debugging
    console.error("Unexpected error in generateCommitMessage:", error);
    throw error;
  }
}

async function analyzeChanges(
  git: any,
  files: any[],
): Promise<{
  type: string;
  scope: string;
  description: string;
  fileTypes: string[];
  changeTypes: string[];
}> {
  try {
    if (!files || files.length === 0) {
      throw new ValidationError("No files provided for analysis");
    }

    const fileTypes = new Set<string>();
    const changeTypes = new Set<string>();
    let hasNewFiles = false;
    let hasDeletedFiles = false;
    let hasModifiedFiles = false;

    // Analyze file changes with error handling
    for (const file of files) {
      try {
        if (!file || !file.file) {
          console.warn("Invalid file object found, skipping:", file);
          continue;
        }

        const fileName = file.file;
        const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

        // Only add meaningful extensions
        if (extension && extension.length <= 10) {
          fileTypes.add(extension);
        }

        // Type guard to check if file has insertions/deletions properties
        if (
          "insertions" in file &&
          "deletions" in file &&
          typeof file.insertions === "number" &&
          typeof file.deletions === "number"
        ) {
          if (file.insertions > 0 && file.deletions === 0) {
            hasNewFiles = true;
            changeTypes.add("addition");
          } else if (file.deletions > 0 && file.insertions === 0) {
            hasDeletedFiles = true;
            changeTypes.add("deletion");
          } else {
            hasModifiedFiles = true;
            changeTypes.add("modification");
          }
        } else {
          // For binary files or other types without insertions/deletions
          hasModifiedFiles = true;
          changeTypes.add("modification");
        }
      } catch (fileError) {
        console.warn(
          `Error analyzing file ${file?.file || "unknown"}:`,
          fileError,
        );
        // Continue processing other files
      }
    }

    // Ensure we have at least some data
    if (fileTypes.size === 0) {
      fileTypes.add("unknown");
    }

    if (changeTypes.size === 0) {
      changeTypes.add("modification");
      hasModifiedFiles = true;
    }

    // Determine commit type based on files and changes
    let type = "feat";
    let scope = "";
    let description = "update code";

    // Enhanced type determination with better error handling
    const fileTypeArray = Array.from(fileTypes).filter(
      (item): item is string => typeof item === "string",
    );
    const validFiles = files.filter((f: any) => f && f.file);

    // Determine scope based on file types and paths
    if (
      fileTypes.has("md") &&
      validFiles.length > 0 &&
      validFiles.every(
        (f) =>
          f.file.toLowerCase().includes("readme") || f.file.endsWith(".md"),
      )
    ) {
      type = "docs";
      description = "update documentation";
    } else if (
      fileTypes.has("json") &&
      validFiles.some((f) => f.file === "package.json")
    ) {
      type = "chore";
      description = "update dependencies";
      scope = "deps";
    } else if (
      validFiles.some(
        (f) =>
          f.file.includes("package-lock.json") ||
          f.file.includes("yarn.lock") ||
          f.file.includes("bun.lock"),
      )
    ) {
      type = "chore";
      description = "update lockfile";
      scope = "deps";
    } else if (
      fileTypes.has("ts") ||
      fileTypes.has("js") ||
      fileTypes.has("jsx") ||
      fileTypes.has("tsx")
    ) {
      // Check if it's mainly test files
      if (
        validFiles.length > 0 &&
        validFiles.every(
          (f) =>
            f.file.includes("test") ||
            f.file.includes("spec") ||
            f.file.includes("__tests__") ||
            f.file.endsWith(".test.ts") ||
            f.file.endsWith(".test.js") ||
            f.file.endsWith(".spec.ts") ||
            f.file.endsWith(".spec.js"),
        )
      ) {
        type = "test";
        description = "update tests";
      } else if (hasNewFiles && !hasDeletedFiles) {
        type = "feat";
        description = "add new functionality";
      } else if (hasDeletedFiles && !hasNewFiles) {
        type = "refactor";
        description = "remove code";
      } else if (hasDeletedFiles && hasNewFiles) {
        type = "refactor";
        description = "restructure code";
      } else {
        // More nuanced determination for modifications
        type = hasModifiedFiles ? "refactor" : "fix";
        description = hasModifiedFiles ? "update implementation" : "fix issue";
      }
    } else if (
      fileTypes.has("css") ||
      fileTypes.has("scss") ||
      fileTypes.has("sass") ||
      fileTypes.has("less")
    ) {
      type = "style";
      description = "update styles";
    } else if (
      fileTypes.has("yml") ||
      fileTypes.has("yaml") ||
      fileTypes.has("toml") ||
      fileTypes.has("ini")
    ) {
      type = "chore";
      description = "update configuration";
      scope = "config";
    }

    // Determine scope from directory structure with better error handling
    if (!scope && validFiles.length > 0) {
      try {
        const filePaths = validFiles.map((f) => f.file).filter(Boolean);
        const commonPath = findCommonPath(filePaths);
        if (commonPath && commonPath !== "." && commonPath.length > 0) {
          const scopeParts = commonPath.split("/").filter(Boolean);
          scope = scopeParts[0] ?? "";

          // Sanitize scope - remove common non-meaningful directory names
          if (scope === "src" && scopeParts.length > 1) {
            scope = scopeParts[1] ?? "";
          }
        }
      } catch (error) {
        console.warn("Error determining scope from paths:", error);
        // Continue without scope
      }
    }

    return {
      type,
      scope,
      description,
      fileTypes: fileTypeArray,
      changeTypes: Array.from(changeTypes),
    };
  } catch (error) {
    console.warn("Error in analyzeChanges:", error);
    // Return safe defaults
    return {
      type: "feat",
      scope: "",
      description: "update code",
      fileTypes: ["unknown"],
      changeTypes: ["modification"],
    };
  }
}

function findCommonPath(filePaths: string[]): string {
  try {
    if (!Array.isArray(filePaths) || filePaths.length === 0) return "";

    // Filter out invalid paths
    const validPaths = filePaths.filter(
      (path) =>
        typeof path === "string" && path.length > 0 && !path.startsWith(".."),
    );

    if (validPaths.length === 0) return "";
    if (validPaths.length === 1) {
      const pathParts = validPaths[0]?.split("/") || [];
      return pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : "";
    }

    const splitPaths = validPaths.map((path) =>
      path.split("/").filter(Boolean),
    );
    const commonParts: string[] = [];
    const firstPath = splitPaths[0];

    if (!firstPath || firstPath.length === 0) return "";

    for (let i = 0; i < firstPath.length; i++) {
      const part = firstPath[i];
      if (part && splitPaths.every((path) => path[i] === part)) {
        commonParts.push(part);
      } else {
        break;
      }
    }

    return commonParts.join("/");
  } catch (error) {
    console.warn("Error in findCommonPath:", error);
    return "";
  }
}

async function generateSuggestion(
  analysis: {
    type: string;
    scope: string;
    description: string;
    fileTypes: string[];
    changeTypes: string[];
  },
  style: string,
  includeScope: boolean,
  variant: number,
): Promise<CommitMessageSuggestion> {
  try {
    // Input validation
    if (
      !analysis ||
      typeof analysis.type !== "string" ||
      typeof analysis.description !== "string"
    ) {
      throw new ValidationError("Invalid analysis data provided");
    }

    if (!style || typeof style !== "string") {
      throw new ValidationError("Invalid style provided");
    }

    if (typeof variant !== "number" || variant < 0) {
      throw new ValidationError("Invalid variant number");
    }

    const { type, scope, description } = analysis ?? {
      type: "feat",
      scope: "",
      description: "update code",
    };

    let message = "";
    let rationale = "";
    let example = "";

    // Sanitize inputs
    const safeType = type.toLowerCase().trim();
    const safeScope = scope ? scope.toLowerCase().trim() : "";
    const safeDescription = description.trim();

    switch (style) {
      case "conventional":
        const scopeStr = includeScope && safeScope ? `(${safeScope})` : "";
        if (variant === 0) {
          message = `${safeType}${scopeStr}: ${safeDescription}`;
          rationale = `Standard conventional commit following the type${scopeStr}: description format`;
          example = `git commit -m "${message}"`;
        } else if (variant === 1) {
          const improvedDesc = safeDescription.replace(
            /\bupdate\b/g,
            "improve",
          );
          message = `${safeType}${scopeStr}: ${improvedDesc}`;
          rationale = `Alternative wording emphasizing improvement over simple updates`;
          example = `git commit -m "${message}"`;
        } else if (variant === 2) {
          const modifiedDesc = safeDescription.replace(/\bupdate\b/g, "modify");
          message = `${safeType}${scopeStr}: ${modifiedDesc}`;
          rationale = `Variation using 'modify' to indicate careful, deliberate changes`;
          example = `git commit -m "${message}"`;
        } else {
          // Fallback for higher variants
          message = `${safeType}${scopeStr}: ${safeDescription}`;
          rationale = `Standard conventional commit (variant ${variant})`;
          example = `git commit -m "${message}"`;
        }
        break;

      case "semantic":
        if (variant === 0) {
          message = `${safeType.toUpperCase()}: ${safeDescription}`;
          rationale = `Uppercase semantic format for clear type identification`;
          example = `git commit -m "${message}"`;
        } else if (variant === 1) {
          message = `[${safeType}] ${safeDescription}`;
          rationale = `Bracketed format popular in many open source projects`;
          example = `git commit -m "${message}"`;
        } else {
          message = `${safeType}: ${safeDescription}`;
          rationale = `Simple semantic format (variant ${variant})`;
          example = `git commit -m "${message}"`;
        }
        break;

      case "descriptive":
        if (variant === 0) {
          message = safeDescription
            ? safeDescription.charAt(0).toUpperCase() + safeDescription.slice(1)
            : "Update code";
          rationale = `Natural language description focusing on what was actually changed`;
          example = `git commit -m "${message}"`;
        } else if (variant === 1) {
          const refactoredDesc =
            safeDescription?.replace(/\bupdate\b/g, "refactor") ||
            safeDescription;
          message = refactoredDesc
            ? refactoredDesc.charAt(0).toUpperCase() + refactoredDesc.slice(1)
            : "Refactor code";
          rationale = `Action-focused message emphasizing the nature of the changes`;
          example = `git commit -m "${message}"`;
        } else {
          message =
            safeDescription.charAt(0).toUpperCase() + safeDescription.slice(1);
          rationale = `Descriptive format (variant ${variant})`;
          example = `git commit -m "${message}"`;
        }
        break;

      default:
        message = `${safeType}: ${safeDescription}`;
        rationale = `Default format with basic type and description`;
        example = `git commit -m "${message}"`;
        break;
    }

    // Ensure message is not too long (conventional limit is ~50 chars for subject)
    if (message.length > 72) {
      console.warn(
        `Generated commit message is quite long (${message.length} chars): ${message}`,
      );
    }

    const priority: "primary" | "alternative" =
      variant === 0 ? "primary" : "alternative";

    return {
      message,
      type: safeType,
      scope: includeScope && safeScope ? safeScope : undefined,
      rationale,
      style: style as "conventional" | "semantic" | "descriptive",
      example,
      priority,
      length: message.length,
    };
  } catch (error) {
    console.warn("Error in generateSuggestion:", error);

    // Return a safe fallback suggestion
    const fallbackMessage = "Update code";
    return {
      message: fallbackMessage,
      type: "feat",
      scope: undefined,
      rationale: `Fallback suggestion due to error: ${error instanceof Error ? error.message : "Unknown error"}`,
      style: style as "conventional" | "semantic" | "descriptive",
      example: `git commit -m "${fallbackMessage}"`,
      priority: variant === 0 ? "primary" : "alternative",
      length: fallbackMessage.length,
    };
  }
}

export const getFileChangesInDirectoryTool = tool({
  description: "Gets the code changes made in given directory",
  inputSchema: fileChange,
  execute: getFileChangesInDirectory,
});

export const generateCommitMessageTool = tool({
  description:
    "Generates commit message suggestions based on code changes in a directory",
  inputSchema: commitMessageParams,
  execute: generateCommitMessage,
});

// Export the underlying function for testing
export { generateCommitMessage };
