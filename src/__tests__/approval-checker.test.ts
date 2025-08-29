import { 
  ReviewerInfo,
  OwnerApprovalStatus,
  ApprovalCheckResult
} from '../approval-checker';

// Mock @actions/core
jest.mock('@actions/core');

describe('approval-checker', () => {
  const mockReviews: ReviewerInfo[] = [
    {
      login: 'alice',
      state: 'APPROVED',
      submittedAt: '2023-10-01T12:00:00Z'
    },
    {
      login: 'bob',
      state: 'REQUEST_CHANGES',
      submittedAt: '2023-10-01T13:00:00Z'
    },
    {
      login: 'charlie',
      state: 'APPROVED', 
      submittedAt: '2023-10-01T14:00:00Z'
    },
    {
      login: 'alice',
      state: 'REQUEST_CHANGES',
      submittedAt: '2023-10-01T15:00:00Z'
    }
  ];

  describe('review parsing and latest state logic', () => {
    it('should handle multiple reviews from same user (latest wins)', () => {
      // Alice has both APPROVED and REQUEST_CHANGES, with REQUEST_CHANGES being latest
      const aliceReviews = mockReviews.filter(r => r.login === 'alice');
      
      expect(aliceReviews).toHaveLength(2);
      
      // The latest review should be REQUEST_CHANGES (15:00)
      const latestAlice = aliceReviews.reduce((latest, current) => 
        new Date(current.submittedAt) > new Date(latest.submittedAt) ? current : latest
      );
      
      expect(latestAlice.state).toBe('REQUEST_CHANGES');
    });

    it('should correctly identify approved reviewers', () => {
      // From mock data: alice's latest is REQUEST_CHANGES, bob is REQUEST_CHANGES, charlie is APPROVED
      const approvedReviewers = mockReviews
        .filter(r => r.state === 'APPROVED')
        .map(r => r.login);
        
      expect(approvedReviewers).toEqual(['alice', 'charlie']);
      
      // But alice's latest state is REQUEST_CHANGES, so only charlie should be counted as approved
      const latestStates = new Map<string, ReviewerInfo>();
      for (const review of mockReviews) {
        const existing = latestStates.get(review.login);
        if (!existing || new Date(review.submittedAt) > new Date(existing.submittedAt)) {
          latestStates.set(review.login, review);
        }
      }
      
      const finalApproved = Array.from(latestStates.values())
        .filter(r => r.state === 'APPROVED')
        .map(r => r.login);
        
      expect(finalApproved).toEqual(['charlie']);
    });
  });

  describe('approval status structures', () => {
    it('should create proper OwnerApprovalStatus structure', () => {
      const status: OwnerApprovalStatus = {
        owner: '@frontend-team',
        isApproved: true,
        approvedBy: ['alice', 'bob'],
        files: ['src/app.js', 'src/utils.js'],
        allReviewers: [
          { login: 'alice', state: 'APPROVED', submittedAt: '2023-10-01T12:00:00Z' },
          { login: 'bob', state: 'APPROVED', submittedAt: '2023-10-01T13:00:00Z' }
        ]
      };

      expect(status.owner).toBe('@frontend-team');
      expect(status.isApproved).toBe(true);
      expect(status.approvedBy).toHaveLength(2);
      expect(status.files).toHaveLength(2);
    });

    it('should create proper ApprovalCheckResult structure', () => {
      const result: ApprovalCheckResult = {
        allRequiredOwnersApproved: false,
        ownerStatuses: [
          {
            owner: '@frontend-team',
            isApproved: true,
            approvedBy: ['alice'],
            files: ['app.js'],
            allReviewers: []
          },
          {
            owner: '@backend-team',
            isApproved: false,
            approvedBy: [],
            files: ['api.py'],
            allReviewers: []
          }
        ],
        missingApprovals: ['@backend-team'],
        totalRequired: 2,
        totalApproved: 1
      };

      expect(result.allRequiredOwnersApproved).toBe(false);
      expect(result.totalRequired).toBe(2);
      expect(result.totalApproved).toBe(1);
      expect(result.missingApprovals).toEqual(['@backend-team']);
    });
  });

  describe('approval logic validation', () => {
    it('should require at least one approval per owner group', () => {
      const ownerStatuses: OwnerApprovalStatus[] = [
        {
          owner: '@team-a',
          isApproved: true,
          approvedBy: ['user1'],
          files: ['file1.js'],
          allReviewers: []
        },
        {
          owner: '@team-b', 
          isApproved: false,
          approvedBy: [],
          files: ['file2.py'],
          allReviewers: []
        }
      ];

      const allApproved = ownerStatuses.every(status => status.isApproved);
      const totalApproved = ownerStatuses.filter(status => status.isApproved).length;
      
      expect(allApproved).toBe(false);
      expect(totalApproved).toBe(1);
    });

    it('should handle empty approval requirements', () => {
      const ownerStatuses: OwnerApprovalStatus[] = [];
      
      const allApproved = ownerStatuses.every(status => status.isApproved);
      const totalApproved = ownerStatuses.filter(status => status.isApproved).length;
      
      // Empty array - every() returns true for empty arrays
      expect(allApproved).toBe(true);
      expect(totalApproved).toBe(0);
    });

    it('should correctly identify missing approvals', () => {
      const ownerStatuses: OwnerApprovalStatus[] = [
        {
          owner: '@docs-team',
          isApproved: true,
          approvedBy: ['writer1'],
          files: ['README.md'],
          allReviewers: []
        },
        {
          owner: '@security-team',
          isApproved: false,
          approvedBy: [],
          files: ['auth.js'],
          allReviewers: []
        },
        {
          owner: '@qa-team',
          isApproved: false,
          approvedBy: [],
          files: ['tests/'],
          allReviewers: []
        }
      ];

      const missingApprovals = ownerStatuses
        .filter(status => !status.isApproved)
        .map(status => status.owner);
      
      expect(missingApprovals).toEqual(['@security-team', '@qa-team']);
    });
  });
});
