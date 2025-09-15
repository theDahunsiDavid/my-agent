# Code Review Agent with Commit Message Generation

An intelligent AI-powered agent that performs comprehensive code reviews and generates conventional commit messages automatically. Built with TypeScript and powered by Google Gemini AI.

## 🚀 Features

### Code Review Capabilities
- **Intelligent Analysis**: Deep code analysis focusing on correctness, clarity, maintainability, and best practices
- **Multi-file Support**: Reviews multiple files and provides file-by-file feedback
- **Security & Performance**: Identifies potential security vulnerabilities and performance bottlenecks
- **Best Practices**: Enforces coding standards and suggests improvements
- **Teaching Mode**: Provides educational feedback with explanations

### Commit Message Generation
- **Multiple Styles**: Supports Conventional Commits, Semantic, and Descriptive formats
- **Smart Analysis**: Automatically detects change types (feat, fix, docs, style, refactor, test, chore)
- **Scope Detection**: Intelligently determines appropriate scopes from file paths
- **Multiple Suggestions**: Generates 1-5 alternative commit message options
- **Git Integration**: Works with both staged and unstaged changes
- **Usage Examples**: Provides copy-paste ready git commands

### Advanced Features
- **Streaming Output**: Real-time response streaming for better UX
- **Error Handling**: Comprehensive error handling with graceful degradation
- **Type Safety**: Full TypeScript support with strict type checking
- **Testing Suite**: Comprehensive test coverage with multiple test scenarios

## 🛠 Tech Stack

- **Runtime**: [Bun](https://bun.com) - Fast all-in-one JavaScript runtime
- **Language**: TypeScript with strict type checking
- **AI Model**: Google Gemini 2.5 Flash via [AI SDK](https://sdk.vercel.ai)
- **Git Operations**: [simple-git](https://github.com/steveukx/git-js) for Git integration
- **Validation**: [Zod](https://zod.dev) for schema validation and type safety
- **Architecture**: Tool-based AI agent with modular design

## 📦 Installation

### Prerequisites
- [Bun](https://bun.sh) v1.2.22 or higher
- Git repository (for commit message generation)
- Google AI API access (for Gemini model)

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd my-agent
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Configure environment** (if needed)
   Set up your Google AI API credentials according to the [AI SDK documentation](https://sdk.vercel.ai/providers/google).

4. **Verify installation**
   ```bash
   bun run test
   ```

## 🎯 Usage

### Basic Usage

Run the agent with default settings:

```bash
bun run index.ts
```

### Code Review Only
```typescript
await codeReviewAgent(
  "Review the code changes in '../my-project' directory, make your reviews and suggestions file by file"
);
```

### Commit Message Generation Only
```typescript
await codeReviewAgent(
  "Generate 3 commit message suggestions for changes in '../my-project' using conventional style with scope"
);
```

### Combined Review and Commit Messages
```typescript
await codeReviewAgent(
  "Review the code changes in '../my-project' directory, then generate commit message suggestions using conventional format"
);
```

## 🔧 Configuration Options

### Commit Message Generation

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `rootDir` | `string` | - | Directory path to analyze |
| `style` | `"conventional" \| "semantic" \| "descriptive"` | `"conventional"` | Commit message style |
| `maxSuggestions` | `number` (1-5) | `3` | Number of suggestions to generate |
| `includeScope` | `boolean` | `true` | Whether to include scope in conventional commits |

### Commit Message Styles

#### Conventional Commits
```bash
feat(auth): add user authentication system
fix(api): resolve timeout issue in user endpoint
docs: update installation instructions
```

#### Semantic Format
```bash
FEAT: add user authentication system
[FIX] resolve timeout issue in user endpoint
DOCS: update installation instructions
```

#### Descriptive Format
```bash
Add user authentication system
Resolve timeout issue in user endpoint
Update installation instructions
```

## 🧪 Testing

### Run Tests

```bash
# Quick test suite (recommended)
bun run test

# Full comprehensive test suite
bun run test:full

# Verbose output
bun run test:verbose
```

### Test Coverage

The project includes comprehensive tests covering:

- ✅ **Core Functionality**: Basic commit message generation
- ✅ **Edge Cases**: Empty repos, no changes, excluded files
- ✅ **Error Handling**: Invalid directories, non-Git repos
- ✅ **Multiple Styles**: All supported commit message formats
- ✅ **Git Integration**: Staged and unstaged changes
- ✅ **File Analysis**: Different file types and change patterns

### Test Results
```bash
📊 Results: 6 passed, 0 failed
✅ PASS: No changes detected
✅ PASS: TypeScript file addition
✅ PASS: Documentation update
✅ PASS: Multiple suggestions
✅ PASS: Different commit styles
✅ PASS: Error handling - invalid directory
```

## 📁 Project Structure

```
my-agent/
├── README.md                 # Project documentation
├── index.ts                  # Main agent entry point
├── package.json              # Dependencies and scripts
├── prompts.ts                # AI system prompts
├── tools.ts                  # Core tools implementation
├── tsconfig.json             # TypeScript configuration
└── tests/                    # Test suite
    ├── run-tests.ts          # Comprehensive test runner
    ├── simple-test.ts        # Quick test suite
    └── test-utils.ts         # Testing utilities
```

## 🤖 AI Agent Architecture

### Tools Available

1. **`getFileChangesInDirectoryTool`**
   - Analyzes Git changes in a directory
   - Provides detailed file diffs
   - Handles error cases gracefully

2. **`generateCommitMessageTool`**
   - Generates multiple commit message suggestions
   - Supports various commit styles
   - Provides usage examples and rationale

### System Prompts

The agent uses carefully crafted system prompts that:
- Guide code review best practices
- Enforce commit message conventions
- Provide structured output formatting
- Ensure helpful and educational responses

## 📋 API Reference

### `generateCommitMessage(params)`

Generates commit message suggestions based on Git changes.

**Parameters:**
```typescript
interface CommitMessageParams {
  rootDir: string;                    // Directory to analyze
  style?: "conventional" | "semantic" | "descriptive";
  maxSuggestions?: number;            // 1-5, default: 3
  includeScope?: boolean;             // default: true
}
```

**Returns:**
```typescript
interface CommitMessageResponse {
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
}
```

### `getFileChangesInDirectory(params)`

Retrieves detailed Git diff information for files in a directory.

**Parameters:**
```typescript
interface FileChangeParams {
  rootDir: string;                    // Directory to analyze
}
```

**Returns:**
```typescript
Array<{
  file: string;                       // File path
  diff: string;                       // Git diff content
}>
```

## 🔍 Examples

### Example Output

```bash
🎯 Primary Suggestion: feat(auth): add user authentication system

📊 Summary:
- Files Changed: 3
- Change Types: additions, modifications
- Style: conventional

💡 Alternative Suggestions:
1. feat(auth): implement user authentication system
2. feat(auth): introduce user authentication features

🔧 Usage Examples:
git commit -m "feat(auth): add user authentication system"
git add . && git commit -m "feat(auth): add user authentication system"
```

## ⚠️ Error Handling

The agent handles various error conditions gracefully:

- **Invalid Directories**: Provides helpful error messages
- **Non-Git Repositories**: Suggests running `git init`
- **No Changes**: Guides users to make and stage changes
- **Git Operation Failures**: Offers troubleshooting steps
- **Network Issues**: Degrades gracefully with fallback responses

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with tests
4. **Run tests**: `bun run test`
5. **Commit using conventional format**: `git commit -m "feat: add amazing feature"`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines

- Follow conventional commit format
- Add tests for new features
- Ensure TypeScript compliance
- Update documentation as needed
- Test error handling scenarios

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Bun](https://bun.sh) for the incredible JavaScript runtime
- [AI SDK](https://sdk.vercel.ai) for seamless AI integration
- [simple-git](https://github.com/steveukx/git-js) for Git operations
- [Zod](https://zod.dev) for type-safe validation
- Google Gemini for powerful AI capabilities

---

**Built with ❤️ using TypeScript and Bun**

For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/your-username/my-agent).