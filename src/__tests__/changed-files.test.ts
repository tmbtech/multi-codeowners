import { getChangedFilenames, ChangedFile } from '../changed-files';

// Mock @actions/core
jest.mock('@actions/core');

describe('getChangedFilenames', () => {
  const mockChangedFiles: ChangedFile[] = [
    {
      filename: 'src/app.js',
      status: 'added',
      additions: 10,
      deletions: 0,
      changes: 10
    },
    {
      filename: 'src/utils.ts',
      status: 'modified',
      additions: 5,
      deletions: 2,
      changes: 7
    },
    {
      filename: 'old-file.py',
      status: 'removed',
      additions: 0,
      deletions: 20,
      changes: 20
    },
    {
      filename: 'renamed-file.md',
      status: 'renamed',
      additions: 1,
      deletions: 1,
      changes: 2
    }
  ];

  it('should return all filenames by default', () => {
    const filenames = getChangedFilenames(mockChangedFiles);
    
    expect(filenames).toEqual([
      'src/app.js',
      'src/utils.ts',
      'renamed-file.md'
    ]);
  });

  it('should include deleted files when requested', () => {
    const filenames = getChangedFilenames(mockChangedFiles, { 
      includeDeleted: true 
    });
    
    expect(filenames).toEqual([
      'src/app.js',
      'src/utils.ts',
      'old-file.py',
      'renamed-file.md'
    ]);
  });

  it('should exclude renamed files when requested', () => {
    const filenames = getChangedFilenames(mockChangedFiles, { 
      includeRenamed: false 
    });
    
    expect(filenames).toEqual([
      'src/app.js',
      'src/utils.ts'
    ]);
  });

  it('should handle custom filtering options', () => {
    const filenames = getChangedFilenames(mockChangedFiles, { 
      includeDeleted: true,
      includeRenamed: false
    });
    
    expect(filenames).toEqual([
      'src/app.js',
      'src/utils.ts',
      'old-file.py'
    ]);
  });

  it('should handle empty array', () => {
    const filenames = getChangedFilenames([]);
    
    expect(filenames).toEqual([]);
  });

  it('should handle files with different statuses', () => {
    const mixedFiles: ChangedFile[] = [
      {
        filename: 'new.js',
        status: 'added',
        additions: 100,
        deletions: 0,
        changes: 100
      },
      {
        filename: 'updated.js',
        status: 'modified',
        additions: 10,
        deletions: 5,
        changes: 15
      }
    ];

    const filenames = getChangedFilenames(mixedFiles);
    
    expect(filenames).toEqual(['new.js', 'updated.js']);
  });
});
