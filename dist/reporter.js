"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportResults = reportResults;
const core = __importStar(require("@actions/core"));
const BOT_NAME = 'Code Owners Approval Bot';
const CHECK_NAME = 'code-owners-approval';
const COMMENT_IDENTIFIER = '<!-- code-owners-bot -->';
/**
 * Report the results of the code owners check via GitHub status check and PR comment
 */
async function reportResults(octokit, context, approvalResult, ownershipMapping) {
    core.info('📊 Reporting code owners check results...');
    const pr = context.payload.pull_request;
    if (!pr) {
        throw new Error('Not a pull request event');
    }
    try {
        // Create or update the status check
        await updateStatusCheck(octokit, context, approvalResult);
        // Create or update the PR comment
        await updatePullRequestComment(octokit, context, approvalResult, ownershipMapping);
        core.info('✅ Successfully reported code owners check results');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.error(`❌ Failed to report results: ${errorMessage}`);
        throw new Error(`Failed to report results: ${errorMessage}`);
    }
}
/**
 * Create or update the GitHub status check
 */
async function updateStatusCheck(octokit, context, approvalResult) {
    const { owner, repo } = context.repo;
    const sha = context.payload.pull_request.head.sha;
    const conclusion = approvalResult.allRequiredOwnersApproved ? 'success' : 'failure';
    const summary = createCheckSummary(approvalResult);
    const title = approvalResult.allRequiredOwnersApproved
        ? `All required code owners have approved (${approvalResult.totalApproved}/${approvalResult.totalRequired})`
        : `Missing approvals from ${approvalResult.missingApprovals.length} owner groups`;
    try {
        // Try to find existing check run
        const existingChecks = await octokit.rest.checks.listForRef({
            owner,
            repo,
            ref: sha,
            check_name: CHECK_NAME,
            per_page: 1
        });
        if (existingChecks.data.check_runs.length > 0) {
            // Update existing check
            const checkId = existingChecks.data.check_runs[0].id;
            await octokit.rest.checks.update({
                owner,
                repo,
                check_run_id: checkId,
                name: CHECK_NAME,
                status: 'completed',
                conclusion,
                output: {
                    title,
                    summary,
                    text: createCheckDetails(approvalResult)
                }
            });
            core.info(`✅ Updated existing check run #${checkId}`);
        }
        else {
            // Create new check
            await octokit.rest.checks.create({
                owner,
                repo,
                name: CHECK_NAME,
                head_sha: sha,
                status: 'completed',
                conclusion,
                output: {
                    title,
                    summary,
                    text: createCheckDetails(approvalResult)
                }
            });
            core.info('✅ Created new check run');
        }
    }
    catch (error) {
        core.warning(`⚠️  Failed to update status check: ${error instanceof Error ? error.message : String(error)}`);
        // Don't fail the entire action if status check fails
    }
}
/**
 * Create or update the PR comment with approval status
 */
async function updatePullRequestComment(octokit, context, approvalResult, ownershipMapping) {
    const { owner, repo } = context.repo;
    const pullNumber = context.payload.pull_request.number;
    const commentBody = createCommentBody(approvalResult, ownershipMapping);
    try {
        // Find existing bot comment
        const comments = await octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: pullNumber,
            per_page: 100
        });
        const existingComment = comments.data.find(comment => comment.body?.includes(COMMENT_IDENTIFIER));
        if (existingComment) {
            // Update existing comment
            await octokit.rest.issues.updateComment({
                owner,
                repo,
                comment_id: existingComment.id,
                body: commentBody
            });
            core.info(`✅ Updated existing PR comment #${existingComment.id}`);
        }
        else {
            // Create new comment
            await octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: pullNumber,
                body: commentBody
            });
            core.info('✅ Created new PR comment');
        }
    }
    catch (error) {
        core.warning(`⚠️  Failed to update PR comment: ${error instanceof Error ? error.message : String(error)}`);
        // Don't fail the entire action if comment fails
    }
}
/**
 * Create the summary for the status check
 */
function createCheckSummary(approvalResult) {
    if (approvalResult.totalRequired === 0) {
        return 'No code owners are required for the changes in this PR.';
    }
    const { totalApproved, totalRequired, allRequiredOwnersApproved } = approvalResult;
    if (allRequiredOwnersApproved) {
        return `✅ All ${totalRequired} required code owner groups have approved this PR.`;
    }
    else {
        const pending = totalRequired - totalApproved;
        return `⏳ ${totalApproved}/${totalRequired} required code owner groups have approved. ${pending} still pending.`;
    }
}
/**
 * Create detailed text for the status check
 */
function createCheckDetails(approvalResult) {
    if (approvalResult.totalRequired === 0) {
        return 'This PR does not modify any files that require code owner approvals.';
    }
    const lines = [];
    lines.push('## Required Code Owner Approvals\\n');
    for (const status of approvalResult.ownerStatuses) {
        const icon = status.isApproved ? '✅' : '❌';
        const approvalText = status.isApproved
            ? `approved by ${status.approvedBy.join(', ')}`
            : 'pending approval';
        lines.push(`${icon} **${status.owner}** - ${approvalText} (${status.files.length} files)`);
    }
    if (approvalResult.missingApprovals.length > 0) {
        lines.push('\\n### Still needed:');
        for (const owner of approvalResult.missingApprovals) {
            lines.push(`- ${owner}`);
        }
    }
    return lines.join('\\n');
}
/**
 * Create the PR comment body
 */
function createCommentBody(approvalResult, ownershipMapping) {
    const lines = [];
    lines.push(COMMENT_IDENTIFIER);
    lines.push('');
    lines.push('## 👥 Code Owners Approval Status');
    lines.push('');
    if (approvalResult.totalRequired === 0) {
        lines.push('✅ **No code owners are required for this PR.**');
        lines.push('');
        lines.push('The files changed in this PR do not match any patterns in the CODEOWNERS file.');
    }
    else {
        // Overall status
        if (approvalResult.allRequiredOwnersApproved) {
            lines.push('✅ **All required code owners have approved this PR!** 🎉');
        }
        else {
            lines.push(`⏳ **${approvalResult.totalApproved}/${approvalResult.totalRequired} required code owner groups have approved.**`);
        }
        lines.push('');
        // Detailed status for each owner
        lines.push('### Required Approvals:');
        lines.push('');
        for (const status of approvalResult.ownerStatuses) {
            const icon = status.isApproved ? '✅' : '❌';
            const checkboxIcon = status.isApproved ? '[x]' : '[ ]';
            if (status.isApproved) {
                const approvers = status.approvedBy.map(user => `@${user}`).join(', ');
                lines.push(`- ${checkboxIcon} **${status.owner}** (approved by ${approvers})`);
            }
            else {
                lines.push(`- ${checkboxIcon} **${status.owner}** (pending)`);
            }
            // Show affected files (limit to 5 per owner)
            const filesToShow = status.files.slice(0, 5);
            const hasMore = status.files.length > 5;
            for (const file of filesToShow) {
                lines.push(`  - \`${file}\``);
            }
            if (hasMore) {
                lines.push(`  - ... and ${status.files.length - 5} more files`);
            }
            lines.push('');
        }
    }
    // Footer
    lines.push('---');
    lines.push('*This comment is automatically updated by the Dynamic Code Owners Reviewer Bot*');
    return lines.join('\\n');
}
//# sourceMappingURL=reporter.js.map