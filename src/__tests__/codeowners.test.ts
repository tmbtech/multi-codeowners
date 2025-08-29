import { 
  parseCodeOwnersContent, 
  matchOwners, 
  getRequiredOwnersForFiles,
  clearCache
} from '../codeowners';

describe('parseCodeOwnersContent', () => {
  beforeEach(() => {
    clearCache();
  });

  it('should parse valid CODEOWNERS content', () => {
    const content = `
# This is a comment
*.js @js-team @dev-team
*.ts @ts-team
/docs/ @docs-team
*.md @docs-team @content-team
`;

    const result = parseCodeOwnersContent(content);
    
    expect(result.rules).toHaveLength(4);
    expect(result.rules[0]).toEqual({
      pattern: '*.js',
      owners: ['@js-team', '@dev-team']
    });
    expect(result.rules[1]).toEqual({
      pattern: '*.ts',
      owners: ['@ts-team']
    });
    expect(result.rules[2]).toEqual({
      pattern: '/docs/',
      owners: ['@docs-team']
    });
    expect(result.rules[3]).toEqual({
      pattern: '*.md',
      owners: ['@docs-team', '@content-team']
    });
  });

  it('should skip empty lines and comments', () => {
    const content = `
# Global owners
* @global-team

# Frontend owners
*.js @js-team

# Empty line below

# Backend owners
*.py @python-team
`;

    const result = parseCodeOwnersContent(content);
    
    expect(result.rules).toHaveLength(3);
    expect(result.rules.map(r => r.pattern)).toEqual(['*', '*.js', '*.py']);
  });

  it('should handle malformed lines gracefully', () => {
    const content = `
*.js @js-team
malformed-line
*.ts @ts-team
single-pattern-no-owners
`;

    const result = parseCodeOwnersContent(content);
    
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0]).toEqual({
      pattern: '*.js',
      owners: ['@js-team']
    });
    expect(result.rules[1]).toEqual({
      pattern: '*.ts',
      owners: ['@ts-team']
    });
  });
});

describe('matchOwners', () => {
  beforeEach(() => {
    clearCache();
  });

  it('should match file patterns correctly', () => {
    const codeOwners = parseCodeOwnersContent(`
*.js @js-team
*.ts @ts-team
/docs/ @docs-team
*.md @docs-team
`);

    expect(matchOwners('app.js', codeOwners)).toEqual(['@js-team']);
    expect(matchOwners('src/utils.ts', codeOwners)).toEqual(['@ts-team']);
    expect(matchOwners('docs/readme.md', codeOwners)).toEqual(['@docs-team']); // Last match wins
    expect(matchOwners('other.md', codeOwners)).toEqual(['@docs-team']);
    expect(matchOwners('unknown.py', codeOwners)).toEqual([]);
  });

  it('should handle absolute paths correctly', () => {
    const codeOwners = parseCodeOwnersContent(`
/src/components/ @frontend-team
/src/backend/ @backend-team
*.js @js-team
`);

    expect(matchOwners('src/components/Button.tsx', codeOwners)).toEqual(['@frontend-team']);
    expect(matchOwners('src/backend/api.py', codeOwners)).toEqual(['@backend-team']);
    expect(matchOwners('other/test.js', codeOwners)).toEqual(['@js-team']);
  });

  it('should follow last-match-wins rule', () => {
    const codeOwners = parseCodeOwnersContent(`
* @global-team
*.js @js-team
/src/ @src-team
/src/utils.js @utils-team
`);

    expect(matchOwners('src/utils.js', codeOwners)).toEqual(['@utils-team']);
    expect(matchOwners('src/other.js', codeOwners)).toEqual(['@src-team']);
    expect(matchOwners('root.js', codeOwners)).toEqual(['@js-team']);
    expect(matchOwners('other.py', codeOwners)).toEqual(['@global-team']);
  });

  it('should handle directory patterns', () => {
    const codeOwners = parseCodeOwnersContent(`
docs/ @docs-team
/src/components/ @frontend-team
tests/**/*.js @test-team
`);

    expect(matchOwners('docs/readme.md', codeOwners)).toEqual(['@docs-team']);
    expect(matchOwners('docs/api/guide.md', codeOwners)).toEqual(['@docs-team']);
    expect(matchOwners('src/components/Button.tsx', codeOwners)).toEqual(['@frontend-team']);
    expect(matchOwners('tests/unit/utils.test.js', codeOwners)).toEqual(['@test-team']);
  });
});

describe('getRequiredOwnersForFiles', () => {
  beforeEach(() => {
    clearCache();
  });

  it('should map owners to their required files', () => {
    const codeOwners = parseCodeOwnersContent(`
*.js @js-team @dev-team
*.ts @ts-team @dev-team
*.md @docs-team
/src/ @backend-team
`);

    const files = [
      'app.js',
      'utils.ts',
      'README.md',
      'src/api.py'
    ];

    const result = getRequiredOwnersForFiles(files, codeOwners);

    expect(result.get('@js-team')).toEqual(['app.js']);
    expect(result.get('@dev-team')).toEqual(['app.js', 'utils.ts']);
    expect(result.get('@ts-team')).toEqual(['utils.ts']);
    expect(result.get('@docs-team')).toEqual(['README.md']);
    expect(result.get('@backend-team')).toEqual(['src/api.py']);
  });

  it('should handle files with no matching owners', () => {
    const codeOwners = parseCodeOwnersContent(`
*.js @js-team
`);

    const files = ['app.js', 'unknown.py'];
    const result = getRequiredOwnersForFiles(files, codeOwners);

    expect(result.get('@js-team')).toEqual(['app.js']);
    expect(result.has('@unknown')).toBe(false);
    expect(result.size).toBe(1);
  });
});
