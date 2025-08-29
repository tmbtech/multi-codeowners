"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCodeOwnersContent = parseCodeOwnersContent;
exports.getCodeOwners = getCodeOwners;
exports.matchOwners = matchOwners;
exports.getRequiredOwnersForFiles = getRequiredOwnersForFiles;
exports.clearCache = clearCache;
const core = __importStar(require("@actions/core"));
const micromatch = __importStar(require("micromatch"));
// In-memory cache for the CODEOWNERS file content during a single run
let codeOwnersCache = null;
/**
 * Parse CODEOWNERS file content into structured rules
 */
function parseCodeOwnersContent(content) {
    const rules = [];
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
        const pattern = parts[0];
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
 * Fetch and parse CODEOWNERS file from GitHub repository
 */
async function getCodeOwners(octokit, context) {
    // Return cached result if available
    if (codeOwnersCache) {
        core.info('📋 Using cached CODEOWNERS data');
        return codeOwnersCache;
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
        }
        catch (error) {
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
function matchOwners(filePath, codeOwners) {
    // Process rules in reverse order - last matching rule wins (GitHub behavior)
    for (let i = codeOwners.rules.length - 1; i >= 0; i--) {
        const rule = codeOwners.rules[i];
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
function matchesCodeOwnerPattern(filePath, pattern) {
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
function getRequiredOwnersForFiles(filePaths, codeOwners) {
    const ownerToFilesMap = new Map();
    for (const filePath of filePaths) {
        const owners = matchOwners(filePath, codeOwners);
        for (const owner of owners) {
            if (!ownerToFilesMap.has(owner)) {
                ownerToFilesMap.set(owner, []);
            }
            ownerToFilesMap.get(owner).push(filePath);
        }
    }
    return ownerToFilesMap;
}
/**
 * Reset the cache (useful for testing)
 */
function clearCache() {
    codeOwnersCache = null;
}
//# sourceMappingURL=codeowners.js.map