import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { ApprovalCheckResult } from './approval-checker';

type GitHub = ReturnType<typeof getOctokit>;

const CHECK_NAME = 'code-owners-approval';
const COMMENT_IDENTIFIER = '<!-- code-owners-bot -->';

/**
 * Report the results of the code owners check via GitHub status check and PR comment
 */
export async function reportResults(
  octokit: GitHub,
  context: Context,
  approvalResult: ApprovalCheckResult
): Promise<void> {
  core.info('📊 Reporting code owners check results...');

  const pr = context.payload.pull_request;
  if (!pr) {
    throw new Error('Not a pull request event');
  }

  try {
    // Create or update the status check
    await updateStatusCheck(octokit, context, approvalResult);
    
    // Create or update the PR comment
    await updatePullRequestComment(octokit, context, approvalResult);

    core.info('✅ Successfully reported code owners check results');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`❌ Failed to report results: ${errorMessage}`);
    throw new Error(`Failed to report results: ${errorMessage}`);
  }
}

/**
 * Create or update the GitHub status check
 */
async function updateStatusCheck(
  octokit: GitHub,
  context: Context,
  approvalResult: ApprovalCheckResult
): Promise<void> {
  const { owner, repo } = context.repo;
  const sha = context.payload.pull_request!.head.sha;
  
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
      const checkId = existingChecks.data.check_runs[0]!.id;
      
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
    } else {
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

  } catch (error) {
    core.warning(`⚠️  Failed to update status check: ${error instanceof Error ? error.message : String(error)}`);
    // Don't fail the entire action if status check fails
  }
}

/**
 * Create or update the PR comment with approval status
 */
async function updatePullRequestComment(
  octokit: GitHub,
  context: Context,
  approvalResult: ApprovalCheckResult
): Promise<void> {
  const { owner, repo } = context.repo;
  const pullNumber = context.payload.pull_request!.number;
  
  const commentBody = createCommentBody(approvalResult);

  try {
    // Find existing bot comment
    const comments = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100
    });

    const existingComment = comments.data.find(comment => 
      comment.body?.includes(COMMENT_IDENTIFIER)
    );

    if (existingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: commentBody
      });

      core.info(`✅ Updated existing PR comment #${existingComment.id}`);
    } else {
      // Create new comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: commentBody
      });

      core.info('✅ Created new PR comment');
    }

  } catch (error) {
    core.warning(`⚠️  Failed to update PR comment: ${error instanceof Error ? error.message : String(error)}`);
    // Don't fail the entire action if comment fails
  }
}

/**
 * Create the summary for the status check
 */
function createCheckSummary(approvalResult: ApprovalCheckResult): string {
  if (approvalResult.totalRequired === 0) {
    return 'No code owners are required for the changes in this PR.';
  }

  const { totalApproved, totalRequired, allRequiredOwnersApproved } = approvalResult;
  
  if (allRequiredOwnersApproved) {
    return `✅ All ${totalRequired} required code owner groups have approved this PR.`;
  } else {
    const pending = totalRequired - totalApproved;
    return `⏳ ${totalApproved}/${totalRequired} required code owner groups have approved. ${pending} still pending.`;
  }
}

/**
 * Create detailed text for the status check
 */
function createCheckDetails(approvalResult: ApprovalCheckResult): string {
  if (approvalResult.totalRequired === 0) {
    return 'This PR does not modify any files that require code owner approvals.';
  }

  const lines: string[] = [];
  
  lines.push('## Required Code Owner Approvals');
  lines.push('');
  
  for (const status of approvalResult.ownerStatuses) {
    const icon = status.isApproved ? '✅' : '❌';
    const approvalText = status.isApproved 
      ? `approved by ${status.approvedBy.join(', ')}`
      : 'pending approval';
    
    lines.push(`${icon} **${status.owner}** - ${approvalText} (${status.files.length} files)`);
  }

  if (approvalResult.missingApprovals.length > 0) {
    lines.push('');
    lines.push('### Still needed:');
    for (const owner of approvalResult.missingApprovals) {
      lines.push(`- ${owner}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create the PR comment body
 */
function createCommentBody(
  approvalResult: ApprovalCheckResult
): string {
  const lines: string[] = [];
  
  lines.push(COMMENT_IDENTIFIER);
  lines.push('');
  lines.push('## 👥 Code Owners Approval Status');
  lines.push('');

  if (approvalResult.totalRequired === 0) {
    lines.push('✅ **No code owners are required for this PR.**');
    lines.push('');
    lines.push('The files changed in this PR do not match any patterns in the CODEOWNERS file.');
  } else {
    // Overall status
    if (approvalResult.allRequiredOwnersApproved) {
      lines.push('✅ **All required code owners have approved this PR!** 🎉');
    } else {
      lines.push(`⏳ **${approvalResult.totalApproved}/${approvalResult.totalRequired} required code owner groups have approved.**`);
    }
    lines.push('');

    // Detailed status for each owner
    lines.push('### Required Approvals:');
    lines.push('');
    
    for (const status of approvalResult.ownerStatuses) {
      const checkboxIcon = status.isApproved ? '[x]' : '[ ]';
      
      if (status.isApproved) {
        const approvers = status.approvedBy.map(user => `@${user}`).join(', ');
        lines.push(`- ${checkboxIcon} **${status.owner}** (approved by ${approvers})`);
      } else {
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

  return lines.join('\n');
}
