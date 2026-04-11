import { describe, expect, it } from 'vitest';
import { mapGitDiffToReviewDiffFiles } from './reviewDiffMapper.js';

describe('mapGitDiffToReviewDiffFiles', () => {
  it('maps git diff text into side-by-side review diff files', () => {
    const result =
      mapGitDiffToReviewDiffFiles(`diff --git a/src/sample.ts b/src/sample.ts
index 1111111..2222222 100644
--- a/src/sample.ts
+++ b/src/sample.ts
@@ -1,3 +1,3 @@
-const before = 1;
+const after = 2;
 export const keep = true;
`);

    expect(result).toEqual([
      {
        path: 'src/sample.ts',
        oldPath: 'src/sample.ts',
        newPath: 'src/sample.ts',
        status: 'modified',
        hunks: [
          {
            header: '@@ -1,3 +1,3 @@',
            rows: [
              {
                left: {
                  text: 'const before = 1;',
                  lineNumber: 1,
                  changeType: 'removed',
                },
                right: {
                  text: 'const after = 2;',
                  lineNumber: 1,
                  changeType: 'added',
                },
              },
              {
                left: {
                  text: 'export const keep = true;',
                  lineNumber: 2,
                  changeType: 'context',
                },
                right: {
                  text: 'export const keep = true;',
                  lineNumber: 2,
                  changeType: 'context',
                },
              },
            ],
          },
        ],
      },
    ]);
  });
});
