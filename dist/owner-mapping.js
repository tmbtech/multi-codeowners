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
exports.mapFilesToOwners = mapFilesToOwners;
exports.getAllRequiredOwners = getAllRequiredOwners;
exports.hasRequiredOwners = hasRequiredOwners;
exports.getOwnershipSummary = getOwnershipSummary;
exports.findOrphanedFiles = findOrphanedFiles;
const core = __importStar(require("@actions/core"));
const codeowners_1 = require("./codeowners");
const changed_files_1 = require("./changed-files");
/**
 * Map changed files in a PR to their required owner groups
 */
async function mapFilesToOwners(octokit, context) {
    core.info('🗺️  Mapping changed files to required owners...');
    try {
        // Get the CODEOWNERS configuration
        const codeOwnersData = await (0, codeowners_1.getCodeOwners)(octokit, context);
        // Get the files that need ownership checks
        const changedFiles = await (0, changed_files_1.getFilesForOwnershipCheck)(octokit, context);
        if (changedFiles.length === 0) {
            core.info('📄 No files require ownership checks');
            return {
                requiredOwners: [],
                allAffectedFiles: [],
                codeOwnersData
            };
        }
        // Map files to their required owners
        const ownerToFilesMap = (0, codeowners_1.getRequiredOwnersForFiles)(changedFiles, codeOwnersData);
        // Convert map to array of requirements
        const requiredOwners = [];
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.error(`❌ Failed to map files to owners: ${errorMessage}`);
        throw new Error(`Failed to map files to owners: ${errorMessage}`);
    }
}
/**
 * Get all unique owner handles from the requirements
 */
function getAllRequiredOwners(ownershipMapping) {
    return ownershipMapping.requiredOwners.map(req => req.owner);
}
/**
 * Check if any owners are required for the given changes
 */
function hasRequiredOwners(ownershipMapping) {
    return ownershipMapping.requiredOwners.length > 0;
}
/**
 * Get summary statistics about the ownership requirements
 */
function getOwnershipSummary(ownershipMapping) {
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
function findOrphanedFiles(ownershipMapping) {
    const filesWithOwners = new Set();
    // Collect all files that have owners
    for (const requirement of ownershipMapping.requiredOwners) {
        for (const file of requirement.files) {
            filesWithOwners.add(file);
        }
    }
    // Find files that don't have any owners
    const orphanedFiles = ownershipMapping.allAffectedFiles.filter(file => !filesWithOwners.has(file));
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
//# sourceMappingURL=owner-mapping.js.map