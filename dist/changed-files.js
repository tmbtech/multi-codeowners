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
exports.getChangedFiles = getChangedFiles;
exports.getChangedFilenames = getChangedFilenames;
exports.getFilesForOwnershipCheck = getFilesForOwnershipCheck;
const core = __importStar(require("@actions/core"));
/**
 * Get all changed files in the pull request
 * Handles pagination to fetch up to GitHub's limit (3000 files)
 */
async function getChangedFiles(octokit, context) {
    const pr = context.payload.pull_request;
    if (!pr) {
        throw new Error('Not a pull request event');
    }
    core.info(`🔍 Fetching changed files for PR #${pr.number}`);
    const { owner, repo } = context.repo;
    const pullNumber = pr.number;
    const changedFiles = [];
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
                    status: file.status,
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.error(`❌ Failed to fetch changed files: ${errorMessage}`);
        throw new Error(`Failed to fetch changed files: ${errorMessage}`);
    }
}
/**
 * Get only the filenames of changed files, optionally filtering by status
 */
function getChangedFilenames(changedFiles, options = {}) {
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
async function getFilesForOwnershipCheck(octokit, context) {
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
//# sourceMappingURL=changed-files.js.map