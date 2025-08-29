import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
type GitHub = ReturnType<typeof getOctokit>;
export interface BotResult {
    success: boolean;
    requiredOwners: string[];
    missingApprovals: string[];
}
/**
 * Main bot orchestrator that coordinates all the code owners logic
 */
export declare function runCodeOwnersBot(octokit: GitHub, context: Context): Promise<BotResult>;
export {};
