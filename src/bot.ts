import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { mapFilesToOwners, getAllRequiredOwners, hasRequiredOwners, findOrphanedFiles } from './owner-mapping';
import { checkApprovalStatus } from './approval-checker';
import { reportResults } from './reporter';

type GitHub = ReturnType<typeof getOctokit>;

export interface BotResult {
  success: boolean;
  requiredOwners: string[];
  missingApprovals: string[];
}

/**
 * Main bot orchestrator that coordinates all the code owners logic
 */
export async function runCodeOwnersBot(
  octokit: GitHub,
  context: Context
): Promise<BotResult> {
  core.info('🔍 Running Code Owners Bot logic...');
  
  const pr = context.payload.pull_request!;
  core.info(`Processing PR: ${pr.title} (#${pr.number})`);
  
  try {
    // Step 1: Parse CODEOWNERS file and map changed files to owners
    core.info('📋 Step 1: Mapping changed files to code owners...');
    const ownershipMapping = await mapFilesToOwners(octokit, context);
    
    // Check for orphaned files
    const orphanedFiles = findOrphanedFiles(ownershipMapping);
    if (orphanedFiles.length > 0) {
      core.warning(`Found ${orphanedFiles.length} files with no code owners`);
    }
    
    // Step 2: Check if any owners are required
    if (!hasRequiredOwners(ownershipMapping)) {
      core.info('✅ No code owners are required for this PR');
      
      // Still report results to show status
      const noOwnerResult = {
        allRequiredOwnersApproved: true,
        ownerStatuses: [],
        missingApprovals: [],
        totalRequired: 0,
        totalApproved: 0
      };
      
      await reportResults(octokit, context, noOwnerResult);
      
      return {
        success: true,
        requiredOwners: [],
        missingApprovals: []
      };
    }
    
    // Step 3: Check approval status for all required owners
    core.info('👥 Step 2: Checking approval status...');
    const approvalResult = await checkApprovalStatus(octokit, context, ownershipMapping);
    
    // Step 4: Report results via status check and PR comment
    core.info('📊 Step 3: Reporting results...');
    await reportResults(octokit, context, approvalResult);
    
    // Step 5: Return final result
    const allRequiredOwners = getAllRequiredOwners(ownershipMapping);
    const success = approvalResult.allRequiredOwnersApproved;
    
    core.info(`🏁 Final result: ${success ? 'SUCCESS' : 'FAILURE'}`);
    
    return {
      success,
      requiredOwners: allRequiredOwners,
      missingApprovals: approvalResult.missingApprovals
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`💥 Bot execution failed: ${errorMessage}`);
    
    // Fail-safe: return failure to block merge
    return {
      success: false,
      requiredOwners: [],
      missingApprovals: ['ERROR: Bot execution failed']
    };
  }
}
