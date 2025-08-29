#!/usr/bin/env node
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
exports.run = run;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const bot_1 = require("./bot");
/**
 * Main entry point for the Dynamic Code Owners Reviewer Bot
 */
async function run() {
    try {
        core.info('🚀 Starting Dynamic Code Owners Reviewer Bot');
        const token = core.getInput('token') || process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GITHUB_TOKEN is required');
        }
        const context = github.context;
        // Only run on pull request events
        if (context.eventName !== 'pull_request') {
            core.info(`❌ Event ${context.eventName} is not supported. Only pull_request events are handled.`);
            return;
        }
        if (!context.payload.pull_request) {
            throw new Error('Pull request payload is missing');
        }
        core.info(`📋 Processing PR #${context.payload.pull_request.number} in ${context.repo.owner}/${context.repo.repo}`);
        const octokit = github.getOctokit(token);
        const result = await (0, bot_1.runCodeOwnersBot)(octokit, context);
        // Set action outputs
        core.setOutput('result', result.success ? 'success' : 'failure');
        core.setOutput('required_owners', JSON.stringify(result.requiredOwners));
        core.setOutput('missing_approvals', JSON.stringify(result.missingApprovals));
        core.info('✅ Code Owners Bot completed successfully');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.error(`❌ Code Owners Bot failed: ${errorMessage}`);
        core.setFailed(errorMessage);
    }
}
// Run the action
if (require.main === module) {
    void run();
}
//# sourceMappingURL=index.js.map