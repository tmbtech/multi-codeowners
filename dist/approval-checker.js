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
exports.checkApprovalStatus = checkApprovalStatus;
const core = __importStar(require("@actions/core"));
/**
 * Check the approval status for all required owner groups
 */
async function checkApprovalStatus(octokit, context, ownershipMapping) {
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
        const ownerStatuses = [];
        for (const requirement of ownershipMapping.requiredOwners) {
            const status = await checkOwnerGroupApproval(octokit, context, requirement, reviews);
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
        }
        else {
            core.info(`⏳ Missing approvals from: ${missingApprovals.join(', ')}`);
        }
        return {
            allRequiredOwnersApproved,
            ownerStatuses,
            missingApprovals,
            totalRequired,
            totalApproved
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.error(`❌ Failed to check approval status: ${errorMessage}`);
        throw new Error(`Failed to check approval status: ${errorMessage}`);
    }
}
/**
 * Get all reviews for a pull request with pagination
 */
async function getAllPullRequestReviews(octokit, context) {
    const { owner, repo } = context.repo;
    const pullNumber = context.payload.pull_request.number;
    const reviews = [];
    let page = 1;
    const perPage = 100;
    let hasMoreReviews = true;
    while (hasMoreReviews) {
        const response = await octokit.rest.pulls.listReviews({
            owner,
            repo,
            pull_number: pullNumber,
            page,
            per_page: perPage
        });
        if (response.data.length === 0) {
            hasMoreReviews = false;
        }
        else {
            for (const review of response.data) {
                if (review.user && review.state && review.submitted_at) {
                    reviews.push({
                        login: review.user.login,
                        state: review.state,
                        submittedAt: review.submitted_at
                    });
                }
            }
            if (response.data.length < perPage) {
                hasMoreReviews = false;
            }
            else {
                page++;
            }
        }
    }
    return reviews;
}
/**
 * Check if a specific owner group has approved the changes
 */
async function checkOwnerGroupApproval(octokit, context, requirement, allReviews) {
    const ownerHandle = requirement.owner;
    // Get members of the owner group
    const ownerMembers = await getOwnerGroupMembers(octokit, context, ownerHandle);
    core.info(`👥 Checking ${ownerHandle}: ${ownerMembers.length} members`);
    // Find the latest review state for each member
    const memberLatestReviews = new Map();
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
    const approvedBy = [];
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
async function getOwnerGroupMembers(octokit, context, ownerHandle) {
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
        }
        catch (error) {
            core.warning(`⚠️  Failed to fetch team members for ${ownerHandle}: ${error instanceof Error ? error.message : String(error)}`);
            // Fallback: treat as individual user
            return [teamSlug];
        }
    }
    else {
        // It's an individual user
        return [cleanHandle];
    }
}
//# sourceMappingURL=approval-checker.js.map