import type { ReviewDiffFile } from '../../share/task.js';

type DiffSide = 'left' | 'right';

type ReviewDiffCell = {
  lineNumber?: number;
  text: string;
  changeType: 'context' | 'added' | 'removed' | 'empty';
};

type ReviewDiffRow = {
  left: ReviewDiffCell;
  right: ReviewDiffCell;
};

type ReviewDiffHunk = {
  header: string;
  rows: ReviewDiffRow[];
};

type ReviewDiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

type PendingDiffLine = {
  text: string;
  lineNumber: number;
  changeType: Extract<ReviewDiffCell['changeType'], 'added' | 'removed'>;
};

const createEmptyCell = (): ReviewDiffCell => ({
  text: '',
  changeType: 'empty',
});

const normalizeDiffPath = (value?: string): string | undefined => {
  if (!value || value === '/dev/null') {
    return undefined;
  }

  return value.replace(/^[ab]\//, '');
};

const createCell = (side: DiffSide, line?: PendingDiffLine): ReviewDiffCell => {
  if (!line) {
    return createEmptyCell();
  }

  return {
    text: line.text,
    lineNumber: line.lineNumber,
    changeType: side === 'left' ? 'removed' : 'added',
  };
};

const finalizePendingRows = (
  rows: ReviewDiffRow[],
  removedLines: PendingDiffLine[],
  addedLines: PendingDiffLine[],
) => {
  while (removedLines.length > 0 || addedLines.length > 0) {
    const removedLine = removedLines.shift();
    const addedLine = addedLines.shift();
    rows.push({
      left: createCell('left', removedLine),
      right: createCell('right', addedLine),
    });
  }
};

const parseHunkHeader = (
  header: string,
): { oldLine: number; newLine: number } => {
  const matched = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(header);
  if (!matched) {
    return { oldLine: 1, newLine: 1 };
  }

  return {
    oldLine: Number(matched[1]),
    newLine: Number(matched[2]),
  };
};

export const mapGitDiffToReviewDiffFiles = (
  diffText: string,
): ReviewDiffFile[] => {
  const files: ReviewDiffFile[] = [];
  const lines = diffText.split('\n');
  let currentFile: ReviewDiffFile | undefined;
  let currentHunk: ReviewDiffHunk | undefined;
  let removedLines: PendingDiffLine[] = [];
  let addedLines: PendingDiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  const flushPendingRows = () => {
    if (!currentHunk) {
      removedLines = [];
      addedLines = [];
      return;
    }

    finalizePendingRows(currentHunk.rows, removedLines, addedLines);
    removedLines = [];
    addedLines = [];
  };

  const finalizeHunk = () => {
    flushPendingRows();
    currentHunk = undefined;
  };

  const finalizeFile = () => {
    finalizeHunk();
    if (currentFile) {
      currentFile.path =
        currentFile.newPath ?? currentFile.oldPath ?? currentFile.path;
      files.push(currentFile);
    }
    currentFile = undefined;
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      finalizeFile();
      currentFile = {
        path: '',
        status: 'modified',
        hunks: [],
      };
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith('new file mode ')) {
      currentFile.status = 'added';
      continue;
    }

    if (line.startsWith('deleted file mode ')) {
      currentFile.status = 'deleted';
      continue;
    }

    if (line.startsWith('rename from ')) {
      currentFile.status = 'renamed';
      currentFile.oldPath = line.replace('rename from ', '').trim();
      continue;
    }

    if (line.startsWith('rename to ')) {
      currentFile.status = 'renamed';
      currentFile.newPath = line.replace('rename to ', '').trim();
      continue;
    }

    if (line.startsWith('--- ')) {
      currentFile.oldPath = normalizeDiffPath(line.replace('--- ', '').trim());
      continue;
    }

    if (line.startsWith('+++ ')) {
      currentFile.newPath = normalizeDiffPath(line.replace('+++ ', '').trim());
      continue;
    }

    if (line.startsWith('Binary files ')) {
      currentFile.hunks.push({
        header: 'Binary file',
        rows: [
          {
            left: { text: 'Binary file', changeType: 'context' },
            right: { text: 'Binary file', changeType: 'context' },
          },
        ],
      });
      continue;
    }

    if (line.startsWith('@@ ')) {
      finalizeHunk();
      const parsed = parseHunkHeader(line);
      oldLine = parsed.oldLine;
      newLine = parsed.newLine;
      currentHunk = {
        header: line,
        rows: [],
      };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (line === '\\ No newline at end of file') {
      continue;
    }

    if (line.startsWith('-')) {
      removedLines.push({
        text: line.slice(1),
        lineNumber: oldLine,
        changeType: 'removed',
      });
      oldLine += 1;
      continue;
    }

    if (line.startsWith('+')) {
      addedLines.push({
        text: line.slice(1),
        lineNumber: newLine,
        changeType: 'added',
      });
      newLine += 1;
      continue;
    }

    if (line.startsWith(' ')) {
      flushPendingRows();
      currentHunk.rows.push({
        left: {
          text: line.slice(1),
          lineNumber: oldLine,
          changeType: 'context',
        },
        right: {
          text: line.slice(1),
          lineNumber: newLine,
          changeType: 'context',
        },
      });
      oldLine += 1;
      newLine += 1;
    }
  }

  finalizeFile();

  return files.map((file) => ({
    ...file,
    status: (file.status || 'modified') as ReviewDiffFileStatus,
    path: file.path || file.newPath || file.oldPath || 'unknown',
  }));
};
