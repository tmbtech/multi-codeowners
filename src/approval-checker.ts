import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { OwnershipMapping, OwnerGroupRequirement } from './owner-mapping';

type GitHub = ReturnType<typeof getOctokit>;

export interface ReviewerInfo {
  login: string;
  state: 'APPROVED' | 'REQUEST_CHANGES' | 'COMMENTED' | 'DISMISSED';
  submittedAt: string;
}

export interface OwnerApprovalStatus {
  owner: string;
  isApproved: boolean;
  approvedBy: string[]; // List of users who approved and are in this owner group
  files: string[];
  allReviewers: ReviewerInfo[]; // All reviewers (for debugging/info)
}

export interface ApprovalCheckResult {
  allRequiredOwnersApproved: boolean;
  ownerStatuses: OwnerApprovalStatus[];
  missingApprovals: string[];
  totalRequired: number;
  totalApproved: number;
}

/**
 * Check the approval status for all required owner groups
 */
export async function checkApprovalStatus(
  octokit: GitHub,
  context: Context,
  ownershipMapping: OwnershipMapping
): Promise<ApprovalCheckResult> {
  core.info('🔍 Checking approval status for required owner groups...');

  const pr = context.payload.pull_request;
  if (!pr) {
    throw new Error('Not a pull request event');
  }

  try {
    // Fetch all reviews for the PR
    const reviews = await getAllPullRequestReviews(octokit, context);
    core.info(`📋 Found ${reviews.length} reviews on PR #${pr.number}`);

    // Check approval status for each required owner group
    const ownerStatuses: OwnerApprovalStatus[] = [];
    
    for (const requirement of ownershipMapping.requiredOwners) {
      const status = await checkOwnerGroupApproval(
        octokit,
        context,
        requirement,
        reviews
      );
      ownerStatuses.push(status);
    }

    // Calculate summary results
    const totalRequired = ownerStatuses.length;
    const totalApproved = ownerStatuses.filter(status => status.isApproved).length;
    const allRequiredOwnersApproved = totalApproved === totalRequired;
    const missingApprovals = ownerStatuses
      .filter(status => !status.isApproved)
      .map(status => status.owner);

    core.info(`✅ Approval Status: ${totalApproved}/${totalRequired} owner groups approved`);
    
    if (allRequiredOwnersApproved) {
      core.info('🎉 All required owner groups have approved the changes!');
    } else {
      core.info(`⏳ Missing approvals from: ${missingApprovals.join(', ')}`);
    }

    return {
      allRequiredOwnersApproved,
      ownerStatuses,
      missingApprovals,
      totalRequired,
      totalApproved
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`❌ Failed to check approval status: ${errorMessage}`);
    throw new Error(`Failed to check approval status: ${errorMessage}`);
  }
}

/**
 * Get all reviews for a pull request with pagination
 */
async function getAllPullRequestReviews(
  octokit: GitHub,
  context: Context
): Promise<ReviewerInfo[]> {
  const { owner, repo } = context.repo;
  const pullNumber = context.payload.pull_request!.number;
  
  const reviews: ReviewerInfo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
      page,
      per_page: perPage
    });

    if (response.data.length === 0) {
      break;
    }

    for (const review of response.data) {
      if (review.user && review.state && review.submitted_at) {
        reviews.push({
          login: review.user.login,
          state: review.state as 'APPROVED' | 'REQUEST_CHANGES' | 'COMMENTED' | 'DISMISSED',
          submittedAt: review.submitted_at
        });
      }
    }

    if (response.data.length < perPage) {
      break;
    }

    page++;
  }

  return reviews;
}

/**
 * Check if a specific owner group has approved the changes
 */
async function checkOwnerGroupApproval(
  octokit: GitHub,
  context: Context,
  requirement: OwnerGroupRequirement,
  allReviews: ReviewerInfo[]
): Promise<OwnerApprovalStatus> {
  const ownerHandle = requirement.owner;
  
  // Get members of the owner group
  const ownerMembers = await getOwnerGroupMembers(octokit, context, ownerHandle);
  
  core.info(`👥 Checking ${ownerHandle}: ${ownerMembers.length} members`);

  // Find the latest review state for each member
  const memberLatestReviews = new Map<string, ReviewerInfo>();
  
  for (const review of allReviews) {
    const memberLogin = review.login.toLowerCase();
    
    // Check if this reviewer is a member of the owner group
    if (ownerMembers.some(member => member.toLowerCase() === memberLogin)) {
      const existing = memberLatestReviews.get(memberLogin);
      
      // Keep only the latest review from each member
      if (!existing || new Date(review.submittedAt) > new Date(existing.submittedAt)) {
        memberLatestReviews.set(memberLogin, review);
      }
    }
  }

  // Check if any member has approved
  const approvedBy: string[] = [];
  for (const [memberLogin, review] of memberLatestReviews.entries()) {
    if (review.state === 'APPROVED') {
      approvedBy.push(memberLogin);
    }
  }

  const isApproved = approvedBy.length > 0;

  core.info(`${isApproved ? '✅' : '❌'} ${ownerHandle}: ${approvedBy.length} approvals (${approvedBy.join(', ') || 'none'})`);

  return {
    owner: ownerHandle,
    isApproved,
    approvedBy,
    files: requirement.files,
    allReviewers: Array.from(memberLatestReviews.values())
  };
}

/**
 * Get members of an owner group (team or individual)
 * This function handles both @username and @org/team-name formats
 */
async function getOwnerGroupMembers(
  octokit: GitHub,
  context: Context,
  ownerHandle: string
): Promise<string[]> {
  // Remove @ prefix if present
  const cleanHandle = ownerHandle.startsWith('@') ? ownerHandle.slice(1) : ownerHandle;
  
  // Check if it's a team reference (org/team-name)
  if (cleanHandle.includes('/')) {
    const [org, teamSlug] = cleanHandle.split('/', 2);
    
    if (!org || !teamSlug) {
      core.warning(`⚠️  Invalid team format: ${ownerHandle}`);
      return [];
    }

    try {
      core.info(`🔍 Fetching members for team: ${org}/${teamSlug}`);
      
      const response = await octokit.rest.teams.listMembersInOrg({
        org,
        team_slug: teamSlug
      });
      
      const members = response.data.map(member => member.login);
      core.info(`👥 Team ${ownerHandle} has ${members.length} members: ${members.join(', ')}`);
      
      return members;
      
    } catch (error) {
      core.warning(`⚠️  Failed to fetch team members for ${ownerHandle}: ${error instanceof Error ? error.message : String(error)}`);
      // Fallback: treat as individual user
      return [teamSlug];
    }
  } else {
    // It's an individual user
    return [cleanHandle];
  }
}
