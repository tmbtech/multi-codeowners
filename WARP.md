# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a GitHub Action that implements a **Dynamic Code Owners Reviewer Bot**. It enforces multi-owner mandatory approvals on Pull Requests, ensuring that ALL relevant code owner groups approve changes before merging, unlike GitHub's native CODEOWNERS which may allow merging with only one approval.

## Development Commands

### Package Management
- **Install dependencies**: `yarn install --frozen-lockfile`
- **Check for updates**: `yarn outdated`

### Development Workflow
- **Build the action**: `yarn build`
- **Run in development mode**: `yarn dev` (uses ts-node to run src/index.ts)
- **Watch for changes during development**: `yarn test:watch`

### Testing
- **Run all tests**: `yarn test`
- **Run tests in watch mode**: `yarn test:watch`
- **Run single test file**: `yarn test src/__tests__/codeowners.test.ts`
- **Run tests with coverage**: `yarn test --coverage`

### Code Quality
- **Lint code**: `yarn lint`
- **Auto-fix linting issues**: `yarn lint:fix`
- **Check TypeScript compilation**: `yarn build`

### GitHub Action Testing
- **Test the action locally**: Build first with `yarn build`, then use `act` or test in a fork
- **Check for uncommitted build artifacts**: The CI workflow will fail if `dist/` changes aren't committed after building

## Architecture Overview

### Core Module Structure
- **`src/index.ts`**: Main entry point that handles GitHub Action setup and orchestration
- **`src/bot.ts`**: Main orchestrator that coordinates the 4-step workflow:
  1. Map changed files to code owners
  2. Check if any owners are required  
  3. Check approval status for all required owners
  4. Report results via status check and PR comment
- **`src/codeowners.ts`**: CODEOWNERS file parsing and pattern matching (supports GitHub's matching behavior)
- **`src/changed-files.ts`**: PR file change detection and filtering
- **`src/owner-mapping.ts`**: Maps files to required owner groups and handles ownership logic
- **`src/approval-checker.ts`**: Checks GitHub review approvals against required owners
- **`src/reporter.ts`**: Creates GitHub status checks and PR comments

### Key Design Patterns

**Fail-Safe by Default**: If any errors occur, the bot defaults to blocking the merge to ensure security.

**Caching**: The CODEOWNERS file is cached in-memory during a single run to avoid redundant API calls.

**GitHub API Integration**: Uses `@actions/github` and `@octokit/rest` for GitHub API interactions with proper error handling and pagination.

**Pattern Matching**: Implements GitHub's CODEOWNERS pattern matching behavior using `micromatch`, including:
- Last-matching-rule-wins behavior
- Directory patterns ending with `/`
- Absolute paths starting with `/`
- Filename-only patterns that match anywhere in the repo

## Testing Strategy

- **Unit Tests**: Comprehensive test coverage for all core modules in `src/__tests__/`
- **Mocking**: Tests mock GitHub Actions core functions and GitHub API calls
- **Setup**: `src/__tests__/setup.ts` configures Jest environment and mocks
- **Test Environment**: Uses `jest` with `ts-jest` preset for TypeScript support

## Build Process

- **Source**: TypeScript files in `src/`
- **Output**: Compiled JavaScript in `dist/` (must be committed for GitHub Actions)
- **TypeScript Config**: Strict compilation with ES2020 target
- **Source Maps**: Generated for debugging support
- **Declaration Files**: Generated for TypeScript users

## GitHub Action Configuration

### Permissions Required
- `contents: read` - Read repository content and CODEOWNERS file  
- `pull-requests: write` - Create and update PR comments
- `checks: write` - Create and update status checks
- `issues: write` - Create PR comments (PRs are issues in GitHub API)

### Trigger Events
- `pull_request`: `opened`, `synchronize`, `ready_for_review`
- `pull_request_review`: `submitted`, `dismissed`

### CODEOWNERS File Locations
The bot searches for CODEOWNERS in this order:
1. `.github/CODEOWNERS`
2. `CODEOWNERS` 
3. `.CODEOWNERS`

## Key Dependencies

- **`@actions/core`**: GitHub Actions toolkit for inputs/outputs/logging
- **`@actions/github`**: GitHub API wrapper with context
- **`@octokit/rest`**: GitHub REST API client
- **`micromatch`**: File pattern matching (implements GitHub's CODEOWNERS behavior)

## Common Development Scenarios

### Adding New Features
1. Write TypeScript code in `src/`
2. Add comprehensive unit tests in `src/__tests__/`
3. Run `yarn test` to ensure all tests pass
4. Run `yarn build` to compile to `dist/`
5. Commit both source and built files

### Debugging GitHub Action Issues
1. Enable debug logging: Set `ACTIONS_STEP_DEBUG: true` in workflow
2. Check GitHub Actions logs for detailed execution traces
3. Test locally with `yarn dev` after setting proper environment variables

### Pattern Matching Issues
The CODEOWNERS pattern matching follows GitHub's specific behavior:
- Patterns are processed bottom-to-top (last match wins)
- Leading `/` makes patterns absolute from repo root
- Trailing `/` matches directories and their contents
- Patterns without `/` match filenames anywhere in repo

### Performance Considerations
- CODEOWNERS file is cached per run
- Changed files are fetched with pagination support
- Team membership checks are batched where possible
