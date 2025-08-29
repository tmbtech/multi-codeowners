# Dynamic Code Owners Reviewer Bot

[![CI](https://github.com/tmbtech/multi-codeowners/actions/workflows/ci.yml/badge.svg)](https://github.com/tmbtech/multi-codeowners/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A GitHub Action that enforces **multi-owner mandatory approvals** on Pull Requests, ensuring that **ALL relevant code owners approve changes** before merging. Unlike GitHub's native CODEOWNERS which may allow merging with only one approval, this bot ensures every required owner group has at least one approval.

## 🎯 Problem Solved

GitHub's native `CODEOWNERS` functionality falls short when multiple file types are modified in a single PR. For example:

- PR modifies both `.js` files (owned by `@frontend-team`) and `.md` files (owned by `@docs-team`)
- GitHub requests reviews from both teams but may allow merging with only one approval
- This bot ensures **BOTH** `@frontend-team` AND `@docs-team` must approve before merging

## ✨ Features

- 🔒 **Multi-owner enforcement**: Requires ALL relevant code owner groups to approve
- 📋 **GitHub CODEOWNERS support**: Works with your existing `.github/CODEOWNERS` file
- 🔍 **Team and user support**: Handles both `@username` and `@org/team-name` patterns
- 💬 **Clear PR comments**: Shows approval status with checkboxes and file listings
- ✅ **Status checks**: Creates GitHub status checks that block merging until approved
- 🚀 **Performance optimized**: Caching and pagination for large repositories
- 🔧 **Fail-safe**: Defaults to blocking merge if any errors occur
- 📊 **Detailed reporting**: Shows which files require which owners

## 📦 Installation

### Option 1: Use as a GitHub Action (Recommended)

1. Create `.github/workflows/code-owners-bot.yml` in your repository:

```yaml
name: 'Code Owners Approval Bot'

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  pull_request_review:
    types: [submitted, dismissed]

permissions:
  contents: read
  pull-requests: write
  checks: write
  issues: write

jobs:
  code-owners-check:
    name: 'Check Code Owners Approvals'
    runs-on: ubuntu-latest
    steps:
      - uses: tmbtech/multi-codeowners@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Option 2: Local Development/Testing

1. Clone this repository
2. Install dependencies: `yarn install`
3. Build: `yarn build`
4. Run locally: `yarn dev`

## 🔧 Configuration

### Required Permissions

The bot requires the following GitHub permissions:

- `contents: read` - Read repository content and CODEOWNERS file
- `pull-requests: write` - Create and update PR comments
- `checks: write` - Create and update status checks
- `issues: write` - Create PR comments (PRs are issues in GitHub API)

### CODEOWNERS File

Create a `.github/CODEOWNERS` file in your repository:

```
# Global owners
* @global-team

# Frontend files
*.js @frontend-team
*.ts @frontend-team
*.tsx @frontend-team

# Backend files
*.py @backend-team
*.go @backend-team

# Documentation
*.md @docs-team
/docs/ @docs-team

# Configuration
*.json @devops-team @security-team
*.yml @devops-team

# Multiple owners for critical files
package.json @frontend-team @devops-team @security-team
```

## 📝 How It Works

1. **Trigger**: Runs on PR events (opened, synchronize, review submitted)
2. **Analysis**: Parses CODEOWNERS and identifies changed files
3. **Mapping**: Maps changed files to required owner groups
4. **Approval Check**: Checks if all required owner groups have approved
5. **Reporting**: Updates GitHub status check and PR comment
6. **Enforcement**: Blocks merge if any required approvals are missing

### Example Scenario

PR changes these files:
- `src/app.js` (requires `@frontend-team`)
- `README.md` (requires `@docs-team`)
- `package.json` (requires `@frontend-team` AND `@devops-team`)

**Required approvals**: `@frontend-team`, `@docs-team`, `@devops-team`

**Result**: PR can only merge when at least one member from each team approves.

## 🎨 PR Comment Example

```markdown
## 👥 Code Owners Approval Status

⏳ **2/3 required code owner groups have approved.**

### Required Approvals:

- [x] **@frontend-team** (approved by @alice)
  - `src/app.js`
  - `package.json`

- [x] **@docs-team** (approved by @bob)
  - `README.md`

- [ ] **@devops-team** (pending)
  - `package.json`

---
*This comment is automatically updated by the Dynamic Code Owners Reviewer Bot*
```

## 🔍 Troubleshooting

### Common Issues

**Bot shows "pending" but team member approved**
- Check if the reviewer is actually a member of the GitHub team
- Ensure team membership is public or bot has org access
- Individual users (`@username`) don't require team membership

**Status check not appearing**
- Verify the bot has `checks: write` permission
- Check GitHub Actions logs for errors
- Ensure the workflow runs on the correct PR events

**CODEOWNERS not found**
- File must be in `.github/CODEOWNERS`, `CODEOWNERS`, or `.CODEOWNERS`
- Check file syntax with GitHub's CODEOWNERS validator
- Ensure file exists in the base branch

### Debug Mode

Enable debug logging by adding to your workflow:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

## 🚀 Advanced Usage

### Skip Bot for Specific PRs

Add a condition to skip certain PRs:

```yaml
jobs:
  code-owners-check:
    if: >-
      github.actor != 'dependabot[bot]' &&
      !contains(github.event.pull_request.labels.*.name, 'skip-owners')
```

### Custom Branch Protection

Configure branch protection to require the status check:

1. Go to Settings → Branches
2. Add rule for your main branch
3. Enable "Require status checks to pass before merging"
4. Select "code-owners-approval" check

## 📜 Example Workflows

This repository includes three example workflow files that demonstrate different use cases:

### 🧪 [test-codeowners-enforcement.yml](.github/workflows/test-codeowners-enforcement.yml)
**Purpose**: Comprehensive testing with multiple scenarios

- **Matrix testing**: Tests different file change scenarios (docs-only, config-only, source-only, etc.)
- **Debug logging**: Enabled by default with `ACTIONS_STEP_DEBUG: true`
- **Artifacts**: Saves action outputs (`result`, `required_owners`, `missing_approvals`) for each scenario
- **Summary reports**: Generates detailed test summaries in GitHub Actions UI

**How to use**:
- Automatically runs on PR events
- Check the "Artifacts" section of workflow runs to download test results
- Look at the "Summary" tab for scenario explanations and results table

### 📋 [template-external-usage.yml](.github/workflows/template-external-usage.yml)
**Purpose**: Copy-paste template for other repositories

- **Comprehensive comments**: Every configuration option is explained
- **Best practices**: Shows recommended permissions, triggers, and conditions
- **Example CODEOWNERS**: Includes a complete example CODEOWNERS file in comments
- **Troubleshooting guide**: Built-in documentation for common issues

**How to use**:
1. Copy this file to your repository as `.github/workflows/codeowners-enforcement.yml`
2. Change the `uses: ./` line to `uses: delavrx1/multi-codeowners@v1`
3. Customize triggers, permissions, and conditions as needed
4. Create a CODEOWNERS file in your repository

### 🎭 [demo-scenarios.yml](.github/workflows/demo-scenarios.yml)
**Purpose**: Interactive demonstrations and testing

- **Multiple scenarios**: Tests different CODEOWNERS patterns in separate jobs
- **Manual triggers**: Use `workflow_dispatch` to test specific scenarios
- **Live examples**: Each job creates a temporary CODEOWNERS file to demonstrate patterns
- **Educational**: Shows multi-owner, single-owner, no-owner, and mixed-ownership scenarios

**How to use**:
- Go to Actions → "Code Owners Demo Scenarios" → "Run workflow"
- Select which scenario to run (or "all" for comprehensive testing)
- Check the job summaries for detailed explanations of each pattern

### 📊 Interpreting Results

**Action Outputs**:
- `result`: `"success"` or `"failure"` - overall approval status
- `required_owners`: JSON array of all owner groups that need approval
- `missing_approvals`: JSON array of owner groups still waiting for approval

**Artifacts** (from test-codeowners-enforcement.yml):
- `test-results-{scenario}/result.txt`: Pass/fail status for each scenario
- `test-results-{scenario}/required_owners.json`: Required owners for that scenario
- `test-results-{scenario}/missing_approvals.json`: Missing approvals for that scenario

**GitHub Action Logs**:
- Enable `ACTIONS_STEP_DEBUG: true` for verbose logging
- Look for "Code Owners Bot" step logs for detailed file mapping
- Check status check details in PR for approval breakdown

## 🧪 Development

### Running Tests

```bash
yarn test          # Run all tests
yarn test:watch    # Run tests in watch mode
yarn lint          # Lint code
yarn build         # Build action
```

### Project Structure

```
src/
├── index.ts              # Main entry point
├── bot.ts               # Main bot orchestrator
├── codeowners.ts        # CODEOWNERS parsing logic
├── changed-files.ts     # PR file change detection
├── owner-mapping.ts     # File to owner mapping
├── approval-checker.ts  # Approval status checking
├── reporter.ts          # GitHub status & comment reporting
└── __tests__/          # Unit tests
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Run tests: `yarn test`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- GitHub's CODEOWNERS documentation
- GitHub Actions ecosystem
- Contributors and users of this action

---

**Need help?** [Open an issue](https://github.com/tmbtech/multi-codeowners/issues) or check the [documentation](https://github.com/tmbtech/multi-codeowners/wiki).
