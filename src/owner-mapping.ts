import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { getCodeOwners, getRequiredOwnersForFiles, ParsedCodeOwners } from './codeowners';
import { getFilesForOwnershipCheck } from './changed-files';

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
export async function mapFilesToOwners(
  octokit: GitHub,
  context: Context
): Promise<OwnershipMapping> {
  core.info('🗺️  Mapping changed files to required owners...');

  try {
    // Get the CODEOWNERS configuration
    const codeOwnersData = await getCodeOwners(octokit, context);
    
    // Get the files that need ownership checks
    const changedFiles = await getFilesForOwnershipCheck(octokit, context);
    
    if (changedFiles.length === 0) {
      core.info('📄 No files require ownership checks');
      return {
        requiredOwners: [],
        allAffectedFiles: [],
        codeOwnersData
      };
    }

    // Map files to their required owners
    const ownerToFilesMap = getRequiredOwnersForFiles(changedFiles, codeOwnersData);
    
    // Convert map to array of requirements
    const requiredOwners: OwnerGroupRequirement[] = [];
    
    for (const [owner, files] of ownerToFilesMap.entries()) {
      requiredOwners.push({
        owner,
        files,
        isRequired: true
      });
    }

    // Sort by owner name for consistent output
    requiredOwners.sort((a, b) => a.owner.localeCompare(b.owner));

    core.info(`👥 Found ${requiredOwners.length} owner groups that need to review changes:`);
    for (const requirement of requiredOwners) {
      core.info(`   • ${requirement.owner}: ${requirement.files.length} files`);
    }

    return {
      requiredOwners,
      allAffectedFiles: changedFiles,
      codeOwnersData
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`❌ Failed to map files to owners: ${errorMessage}`);
    throw new Error(`Failed to map files to owners: ${errorMessage}`);
  }
}

/**
 * Get all unique owner handles from the requirements
 */
export function getAllRequiredOwners(ownershipMapping: OwnershipMapping): string[] {
  return ownershipMapping.requiredOwners.map(req => req.owner);
}

/**
 * Check if any owners are required for the given changes
 */
export function hasRequiredOwners(ownershipMapping: OwnershipMapping): boolean {
  return ownershipMapping.requiredOwners.length > 0;
}

/**
 * Get summary statistics about the ownership requirements
 */
export function getOwnershipSummary(ownershipMapping: OwnershipMapping): {
  totalFiles: number;
  totalOwners: number;
  ownersWithMostFiles: { owner: string; fileCount: number }[];
} {
  const totalFiles = ownershipMapping.allAffectedFiles.length;
  const totalOwners = ownershipMapping.requiredOwners.length;
  
  const ownersWithMostFiles = ownershipMapping.requiredOwners
    .map(req => ({ 
      owner: req.owner, 
      fileCount: req.files.length 
    }))
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 5); // Top 5 owners by file count

  return {
    totalFiles,
    totalOwners,
    ownersWithMostFiles
  };
}

/**
 * Find files that have no code owners (orphaned files)
 */
export function findOrphanedFiles(ownershipMapping: OwnershipMapping): string[] {
  const filesWithOwners = new Set<string>();
  
  // Collect all files that have owners
  for (const requirement of ownershipMapping.requiredOwners) {
    for (const file of requirement.files) {
      filesWithOwners.add(file);
    }
  }
  
  // Find files that don't have any owners
  const orphanedFiles = ownershipMapping.allAffectedFiles.filter(
    file => !filesWithOwners.has(file)
  );
  
  if (orphanedFiles.length > 0) {
    core.warning(`⚠️  Found ${orphanedFiles.length} files with no code owners:`);
    for (const file of orphanedFiles.slice(0, 10)) {
      core.warning(`   • ${file}`);
    }
    if (orphanedFiles.length > 10) {
      core.warning(`   ... and ${orphanedFiles.length - 10} more files`);
    }
  }
  
  return orphanedFiles;
}
