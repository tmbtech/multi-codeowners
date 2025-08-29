import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { OwnershipMapping } from './owner-mapping';
type GitHub = ReturnType<typeof getOctokit>;
export interface ReviewerInfo {
    login: string;
    state: 'APPROVED' | 'REQUEST_CHANGES' | 'COMMENTED' | 'DISMISSED';
    submittedAt: string;
}
export interface OwnerApprovalStatus {
    owner: string;
    isApproved: boolean;
    approvedBy: string[];
    files: string[];
    allReviewers: ReviewerInfo[];
}
export interface ApprovalCheckResult {
    allRequiredOwnersApproved: boolean;
    ownerStatuses: OwnerApprovalStatus[];
    missingApprovals: string[];
    totalRequired: number;
    totalApproved: number;
}
/**
 * Check the approval status for all required owner groups
 */
export declare function checkApprovalStatus(octokit: GitHub, context: Context, ownershipMapping: OwnershipMapping): Promise<ApprovalCheckResult>;
export {};
//# sourceMappingURL=approval-checker.d.ts.map