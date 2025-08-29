import * as core from '@actions/core';
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
export async function getChangedFiles(
  octokit: GitHub,
  context: Context
): Promise<ChangedFile[]> {
  const pr = context.payload.pull_request;
  if (!pr) {
    throw new Error('Not a pull request event');
  }

  core.info(`🔍 Fetching changed files for PR #${pr.number}`);
  
  const { owner, repo } = context.repo;
  const pullNumber = pr.number;
  
  const changedFiles: ChangedFile[] = [];
  let page = 1;
  const perPage = 100; // GitHub API default and max per page
  
  try {
    while (true) {
      core.info(`📄 Fetching page ${page} of changed files (${perPage} per page)`);
      
      const response = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: perPage
      });

      if (response.data.length === 0) {
        break; // No more files
      }

      // Convert GitHub API format to our format
      for (const file of response.data) {
        changedFiles.push({
          filename: file.filename,
          status: file.status as 'added' | 'modified' | 'removed' | 'renamed',
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes
        });
      }

      // If we got fewer files than requested, we're on the last page
      if (response.data.length < perPage) {
        break;
      }

      page++;
      
      // Safety check to prevent infinite loops
      if (page > 30) { // 30 * 100 = 3000 files (GitHub's max)
        core.warning('⚠️  Reached maximum pagination limit (3000 files). Some files may not be included.');
        break;
      }
    }
    
    core.info(`📊 Found ${changedFiles.length} changed files in PR #${pr.number}`);
    
    return changedFiles;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`❌ Failed to fetch changed files: ${errorMessage}`);
    throw new Error(`Failed to fetch changed files: ${errorMessage}`);
  }
}

/**
 * Get only the filenames of changed files, optionally filtering by status
 */
export function getChangedFilenames(
  changedFiles: ChangedFile[],
  options: {
    includeDeleted?: boolean;
    includeRenamed?: boolean;
  } = {}
): string[] {
  const { includeDeleted = false, includeRenamed = true } = options;
  
  return changedFiles
    .filter(file => {
      if (file.status === 'removed' && !includeDeleted) {
        return false;
      }
      if (file.status === 'renamed' && !includeRenamed) {
        return false;
      }
      return true;
    })
    .map(file => file.filename);
}

/**
 * Get files that are relevant for code ownership checks
 * By default, excludes deleted files since they don't need new approvals
 */
export async function getFilesForOwnershipCheck(
  octokit: GitHub,
  context: Context
): Promise<string[]> {
  const changedFiles = await getChangedFiles(octokit, context);
  
  // Filter out deleted files - they don't need new approvals
  const relevantFiles = getChangedFilenames(changedFiles, { 
    includeDeleted: false,
    includeRenamed: true 
  });
  
  // Remove duplicates (shouldn't happen, but safety first)
  const uniqueFiles = Array.from(new Set(relevantFiles));
  
  core.info(`📋 ${uniqueFiles.length} files require ownership checks:`);
  for (const file of uniqueFiles.slice(0, 10)) { // Log first 10 files
    core.info(`   • ${file}`);
  }
  if (uniqueFiles.length > 10) {
    core.info(`   ... and ${uniqueFiles.length - 10} more files`);
  }
  
  return uniqueFiles;
}
