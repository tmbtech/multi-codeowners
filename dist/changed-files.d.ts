import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
type GitHub = ReturnType<typeof getOctokit>;
export interface ChangedFile {
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
}
/**
 * Get all changed files in the pull request
 * Handles pagination to fetch up to GitHub's limit (3000 files)
 */
export declare function getChangedFiles(octokit: GitHub, context: Context): Promise<ChangedFile[]>;
/**
 * Get only the filenames of changed files, optionally filtering by status
 */
export declare function getChangedFilenames(changedFiles: ChangedFile[], options?: {
    includeDeleted?: boolean;
    includeRenamed?: boolean;
}): string[];
/**
 * Get files that are relevant for code ownership checks
 * By default, excludes deleted files since they don't need new approvals
 */
export declare function getFilesForOwnershipCheck(octokit: GitHub, context: Context): Promise<string[]>;
export {};
