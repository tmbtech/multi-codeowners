import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import * as micromatch from 'micromatch';
import * as fs from 'fs';
import * as path from 'path';

type GitHub = ReturnType<typeof getOctokit>;

export interface CodeOwnerRule {
  pattern: string;
  owners: string[];
}

export interface ParsedCodeOwners {
  rules: CodeOwnerRule[];
  rawContent: string;
}

// In-memory cache for the CODEOWNERS file content during a single run
let codeOwnersCache: ParsedCodeOwners | null = null;

/**
 * Parse CODEOWNERS file content into structured rules
 */
export function parseCodeOwnersContent(content: string): ParsedCodeOwners {
  const rules: CodeOwnerRule[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // Split on whitespace to get pattern and owners
    const parts = trimmedLine.split(/\s+/);
    if (parts.length < 2) {
      core.warning(`Invalid CODEOWNERS line: ${line}`);
      continue;
    }

    const pattern = parts[0]!;
    const owners = parts.slice(1).filter(owner => owner.trim().length > 0);

    if (owners.length === 0) {
      core.warning(`No owners specified for pattern: ${pattern}`);
      continue;
    }

    rules.push({ pattern, owners });
  }

  core.info(`📊 Parsed ${rules.length} CODEOWNERS rules`);
  return { rules, rawContent: content };
}

/**
 * Read CODEOWNERS file from filesystem (for demo scenarios)
 */
async function getCodeOwnersFromFilesystem(): Promise<ParsedCodeOwners> {
  const possiblePaths = ['.github/CODEOWNERS', 'CODEOWNERS', '.CODEOWNERS'];
  
  for (const filePath of possiblePaths) {
    try {
      core.info(`🔍 Attempting to read CODEOWNERS from filesystem: ${filePath}`);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        core.info(`✅ Successfully read CODEOWNERS from filesystem: ${filePath}`);
        
        const parsed = parseCodeOwnersContent(content);
        return parsed;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      core.info(`❌ Failed to read ${filePath} from filesystem: ${errorMessage}`);
      continue;
    }
  }
  
  throw new Error('CODEOWNERS file not found on filesystem in any of the expected locations: ' + possiblePaths.join(', '));
}

/**
 * Fetch and parse CODEOWNERS file from GitHub repository
 */
export async function getCodeOwners(
  octokit: GitHub,
  context: Context
): Promise<ParsedCodeOwners> {
  // For demo scenarios, always fetch fresh data to allow temporary CODEOWNERS files
  const isDemoScenario = process.env.DEMO_SCENARIO !== undefined;
  
  // Return cached result if available and not in demo mode
  if (codeOwnersCache && !isDemoScenario) {
    core.info('📋 Using cached CODEOWNERS data');
    return codeOwnersCache;
  }
  
  if (isDemoScenario) {
    core.info('🎭 Demo scenario detected - reading CODEOWNERS from filesystem');
    // In demo scenarios, read from filesystem since we create temporary files
    return await getCodeOwnersFromFilesystem();
  }

  const { owner, repo } = context.repo;
  const possiblePaths = ['.github/CODEOWNERS', 'CODEOWNERS', '.CODEOWNERS'];

  for (const path of possiblePaths) {
    try {
      core.info(`🔍 Attempting to fetch CODEOWNERS from: ${path}`);
      
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: context.payload.pull_request?.base.sha || context.sha
      });

      // Handle the case where response.data is an array (directory) or doesn't have content
      if (Array.isArray(response.data) || !('content' in response.data)) {
        core.warning(`${path} is not a file or has no content`);
        continue;
      }

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      core.info(`✅ Successfully fetched CODEOWNERS from: ${path}`);
      
      // Parse and cache the result
      const parsed = parseCodeOwnersContent(content);
      codeOwnersCache = parsed;
      return parsed;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      core.info(`❌ Failed to fetch ${path}: ${errorMessage}`);
      continue;
    }
  }

  throw new Error('CODEOWNERS file not found in any of the expected locations: ' + possiblePaths.join(', '));
}

/**
 * Match a file path against CODEOWNERS rules and return the required owners
 */
export function matchOwners(filePath: string, codeOwners: ParsedCodeOwners): string[] {
  // Process rules in reverse order - last matching rule wins (GitHub behavior)
  for (let i = codeOwners.rules.length - 1; i >= 0; i--) {
    const rule = codeOwners.rules[i]!;
    
    if (matchesCodeOwnerPattern(filePath, rule.pattern)) {
      return rule.owners;
    }
  }

  return [];
}

/**
 * Check if a file path matches a CODEOWNERS pattern
 * This follows GitHub CODEOWNERS matching behavior
 */
function matchesCodeOwnerPattern(filePath: string, pattern: string): boolean {
  // Handle leading slash (absolute path from repo root)
  let normalizedPattern = pattern;
  if (normalizedPattern.startsWith('/')) {
    normalizedPattern = normalizedPattern.slice(1);
  }
  
  // Handle directory patterns (ending with /)
  if (normalizedPattern.endsWith('/')) {
    normalizedPattern = normalizedPattern + '**';
  }
  
  // For patterns without slashes and not starting with *, 
  // GitHub matches against the filename anywhere in the repo
  if (!normalizedPattern.includes('/') && !normalizedPattern.startsWith('**/')) {
    // Try exact match first
    if (micromatch.isMatch(filePath, normalizedPattern, { dot: true })) {
      return true;
    }
    // Then try matching with **/ prefix to match anywhere
    normalizedPattern = '**/' + normalizedPattern;
  }
  
  return micromatch.isMatch(filePath, normalizedPattern, { dot: true });
}

/**
 * Get all unique owners for a list of file paths
 */
export function getRequiredOwnersForFiles(
  filePaths: string[],
  codeOwners: ParsedCodeOwners
): Map<string, string[]> {
  const ownerToFilesMap = new Map<string, string[]>();

  for (const filePath of filePaths) {
    const owners = matchOwners(filePath, codeOwners);
    
    for (const owner of owners) {
      if (!ownerToFilesMap.has(owner)) {
        ownerToFilesMap.set(owner, []);
      }
      ownerToFilesMap.get(owner)!.push(filePath);
    }
  }

  return ownerToFilesMap;
}

/**
 * Reset the cache (useful for testing)
 */
export function clearCache(): void {
  codeOwnersCache = null;
}
