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
exports.runCodeOwnersBot = runCodeOwnersBot;
const core = __importStar(require("@actions/core"));
const owner_mapping_1 = require("./owner-mapping");
const approval_checker_1 = require("./approval-checker");
const reporter_1 = require("./reporter");
/**
 * Main bot orchestrator that coordinates all the code owners logic
 */
async function runCodeOwnersBot(octokit, context) {
    core.info('🔍 Running Code Owners Bot logic...');
    const pr = context.payload.pull_request;
    core.info(`Processing PR: ${pr.title} (#${pr.number})`);
    try {
        // Step 1: Parse CODEOWNERS file and map changed files to owners
        core.info('📋 Step 1: Mapping changed files to code owners...');
        const ownershipMapping = await (0, owner_mapping_1.mapFilesToOwners)(octokit, context);
        // Check for orphaned files
        const orphanedFiles = (0, owner_mapping_1.findOrphanedFiles)(ownershipMapping);
        if (orphanedFiles.length > 0) {
            core.warning(`Found ${orphanedFiles.length} files with no code owners`);
        }
        // Step 2: Check if any owners are required
        if (!(0, owner_mapping_1.hasRequiredOwners)(ownershipMapping)) {
            core.info('✅ No code owners are required for this PR');
            // Still report results to show status
            const noOwnerResult = {
                allRequiredOwnersApproved: true,
                ownerStatuses: [],
                missingApprovals: [],
                totalRequired: 0,
                totalApproved: 0
            };
            await (0, reporter_1.reportResults)(octokit, context, noOwnerResult, ownershipMapping);
            return {
                success: true,
                requiredOwners: [],
                missingApprovals: []
            };
        }
        // Step 3: Check approval status for all required owners
        core.info('👥 Step 2: Checking approval status...');
        const approvalResult = await (0, approval_checker_1.checkApprovalStatus)(octokit, context, ownershipMapping);
        // Step 4: Report results via status check and PR comment
        core.info('📊 Step 3: Reporting results...');
        await (0, reporter_1.reportResults)(octokit, context, approvalResult, ownershipMapping);
        // Step 5: Return final result
        const allRequiredOwners = (0, owner_mapping_1.getAllRequiredOwners)(ownershipMapping);
        const success = approvalResult.allRequiredOwnersApproved;
        core.info(`🏁 Final result: ${success ? 'SUCCESS' : 'FAILURE'}`);
        return {
            success,
            requiredOwners: allRequiredOwners,
            missingApprovals: approvalResult.missingApprovals
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.error(`💥 Bot execution failed: ${errorMessage}`);
        // Fail-safe: return failure to block merge
        return {
            success: false,
            requiredOwners: [],
            missingApprovals: ['ERROR: Bot execution failed']
        };
    }
}
//# sourceMappingURL=bot.js.map