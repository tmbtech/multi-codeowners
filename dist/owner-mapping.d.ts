import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { ParsedCodeOwners } from './codeowners';
type GitHub = ReturnType<typeof getOctokit>;
export interface OwnerGroupRequirement {
    owner: string;
    files: string[];
    isRequired: boolean;
}
export interface OwnershipMapping {
    requiredOwners: OwnerGroupRequirement[];
    allAffectedFiles: string[];
    codeOwnersData: ParsedCodeOwners;
}
/**
 * Map changed files in a PR to their required owner groups
 */
export declare function mapFilesToOwners(octokit: GitHub, context: Context): Promise<OwnershipMapping>;
/**
 * Get all unique owner handles from the requirements
 */
export declare function getAllRequiredOwners(ownershipMapping: OwnershipMapping): string[];
/**
 * Check if any owners are required for the given changes
 */
export declare function hasRequiredOwners(ownershipMapping: OwnershipMapping): boolean;
/**
 * Get summary statistics about the ownership requirements
 */
export declare function getOwnershipSummary(ownershipMapping: OwnershipMapping): {
    totalFiles: number;
    totalOwners: number;
    ownersWithMostFiles: {
        owner: string;
        fileCount: number;
    }[];
};
/**
 * Find files that have no code owners (orphaned files)
 */
export declare function findOrphanedFiles(ownershipMapping: OwnershipMapping): string[];
export {};
//# sourceMappingURL=owner-mapping.d.ts.map