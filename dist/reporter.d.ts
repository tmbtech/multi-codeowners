import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { ApprovalCheckResult } from './approval-checker';
import { OwnershipMapping } from './owner-mapping';
type GitHub = ReturnType<typeof getOctokit>;
/**
 * Report the results of the code owners check via GitHub status check and PR comment
 */
export declare function reportResults(octokit: GitHub, context: Context, approvalResult: ApprovalCheckResult, ownershipMapping: OwnershipMapping): Promise<void>;
export {};
//# sourceMappingURL=reporter.d.ts.map