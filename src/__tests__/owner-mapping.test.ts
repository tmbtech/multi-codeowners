import { 
  getAllRequiredOwners, 
  hasRequiredOwners, 
  getOwnershipSummary,
  findOrphanedFiles,
  OwnershipMapping 
} from '../owner-mapping';
import { parseCodeOwnersContent } from '../codeowners';

// Mock @actions/core
jest.mock('@actions/core');

describe('owner-mapping utilities', () => {
  const mockOwnershipMapping: OwnershipMapping = {
    requiredOwners: [
      {
        owner: '@js-team',
        files: ['app.js', 'utils.js'],
        isRequired: true
      },
      {
        owner: '@ts-team',
        files: ['components.ts'],
        isRequired: true
      },
      {
        owner: '@docs-team',
        files: ['README.md', 'CHANGELOG.md', 'docs/guide.md'],
        isRequired: true
      }
    ],
    allAffectedFiles: ['app.js', 'utils.js', 'components.ts', 'README.md', 'CHANGELOG.md', 'docs/guide.md', 'orphaned.py'],
    codeOwnersData: parseCodeOwnersContent(`
*.js @js-team
*.ts @ts-team
*.md @docs-team
`)
  };

  describe('getAllRequiredOwners', () => {
    it('should return all unique owner handles', () => {
      const owners = getAllRequiredOwners(mockOwnershipMapping);
      
      expect(owners).toEqual(['@js-team', '@ts-team', '@docs-team']);
    });

    it('should handle empty requirements', () => {
      const emptyMapping: OwnershipMapping = {
        requiredOwners: [],
        allAffectedFiles: [],
        codeOwnersData: parseCodeOwnersContent('')
      };
      
      const owners = getAllRequiredOwners(emptyMapping);
      
      expect(owners).toEqual([]);
    });
  });

  describe('hasRequiredOwners', () => {
    it('should return true when owners are required', () => {
      expect(hasRequiredOwners(mockOwnershipMapping)).toBe(true);
    });

    it('should return false when no owners are required', () => {
      const emptyMapping: OwnershipMapping = {
        requiredOwners: [],
        allAffectedFiles: [],
        codeOwnersData: parseCodeOwnersContent('')
      };
      
      expect(hasRequiredOwners(emptyMapping)).toBe(false);
    });
  });

  describe('getOwnershipSummary', () => {
    it('should provide accurate summary statistics', () => {
      const summary = getOwnershipSummary(mockOwnershipMapping);
      
      expect(summary).toEqual({
        totalFiles: 7,
        totalOwners: 3,
        ownersWithMostFiles: [
          { owner: '@docs-team', fileCount: 3 },
          { owner: '@js-team', fileCount: 2 },
          { owner: '@ts-team', fileCount: 1 }
        ]
      });
    });

    it('should handle empty mapping', () => {
      const emptyMapping: OwnershipMapping = {
        requiredOwners: [],
        allAffectedFiles: [],
        codeOwnersData: parseCodeOwnersContent('')
      };
      
      const summary = getOwnershipSummary(emptyMapping);
      
      expect(summary).toEqual({
        totalFiles: 0,
        totalOwners: 0,
        ownersWithMostFiles: []
      });
    });

    it('should limit to top 5 owners', () => {
      const manyOwnersMapping: OwnershipMapping = {
        requiredOwners: Array.from({ length: 10 }, (_, i) => ({
          owner: `@team${i}`,
          files: [`file${i}.js`],
          isRequired: true
        })),
        allAffectedFiles: Array.from({ length: 10 }, (_, i) => `file${i}.js`),
        codeOwnersData: parseCodeOwnersContent('')
      };
      
      const summary = getOwnershipSummary(manyOwnersMapping);
      
      expect(summary.ownersWithMostFiles).toHaveLength(5);
    });
  });

  describe('findOrphanedFiles', () => {
    it('should identify files with no code owners', () => {
      const orphanedFiles = findOrphanedFiles(mockOwnershipMapping);
      
      expect(orphanedFiles).toEqual(['orphaned.py']);
    });

    it('should return empty array when all files have owners', () => {
      const completeMapping: OwnershipMapping = {
        requiredOwners: [
          {
            owner: '@team',
            files: ['file1.js', 'file2.js'],
            isRequired: true
          }
        ],
        allAffectedFiles: ['file1.js', 'file2.js'],
        codeOwnersData: parseCodeOwnersContent('*.js @team')
      };
      
      const orphanedFiles = findOrphanedFiles(completeMapping);
      
      expect(orphanedFiles).toEqual([]);
    });

    it('should handle empty mapping', () => {
      const emptyMapping: OwnershipMapping = {
        requiredOwners: [],
        allAffectedFiles: [],
        codeOwnersData: parseCodeOwnersContent('')
      };
      
      const orphanedFiles = findOrphanedFiles(emptyMapping);
      
      expect(orphanedFiles).toEqual([]);
    });
  });
});
