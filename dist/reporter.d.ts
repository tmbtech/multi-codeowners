import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { ApprovalCheckResult } from './approval-checker';
type GitHub = ReturnType<typeof getOctokit>;
/**
 * Report the results of the code owners check via GitHub status check and PR comment
 */
export declare function reportResults(octokit: GitHub, context: Context, approvalResult: ApprovalCheckResult): Promise<void>;
export {};
