import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
type GitHub = ReturnType<typeof getOctokit>;
export interface CodeOwnerRule {
    pattern: string;
    owners: string[];
}
export interface ParsedCodeOwners {
    rules: CodeOwnerRule[];
    rawContent: string;
}
/**
 * Parse CODEOWNERS file content into structured rules
 */
export declare function parseCodeOwnersContent(content: string): ParsedCodeOwners;
/**
 * Fetch and parse CODEOWNERS file from GitHub repository
 */
export declare function getCodeOwners(octokit: GitHub, context: Context): Promise<ParsedCodeOwners>;
/**
 * Match a file path against CODEOWNERS rules and return the required owners
 */
export declare function matchOwners(filePath: string, codeOwners: ParsedCodeOwners): string[];
/**
 * Get all unique owners for a list of file paths
 */
export declare function getRequiredOwnersForFiles(filePaths: string[], codeOwners: ParsedCodeOwners): Map<string, string[]>;
/**
 * Reset the cache (useful for testing)
 */
export declare function clearCache(): void;
export {};
