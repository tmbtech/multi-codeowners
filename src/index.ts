#!/usr/bin/env node

import * as core from '@actions/core';
import * as github from '@actions/github';
import { runCodeOwnersBot } from './bot';

/**
 * Main entry point for the Dynamic Code Owners Reviewer Bot
 */
async function run(): Promise<void> {
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
    
    const result = await runCodeOwnersBot(octokit, context);
    
    // Set action outputs
    core.setOutput('result', result.success ? 'success' : 'failure');
    core.setOutput('required_owners', JSON.stringify(result.requiredOwners));
    core.setOutput('missing_approvals', JSON.stringify(result.missingApprovals));
    
    core.info('✅ Code Owners Bot completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`❌ Code Owners Bot failed: ${errorMessage}`);
    core.setFailed(errorMessage);
  }
}

// Run the action
if (require.main === module) {
  void run();
}

export { run };
