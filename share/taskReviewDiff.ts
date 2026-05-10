type ReviewDiffCellChangeType = 'context' | 'added' | 'removed' | 'empty';

type ReviewDiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

type ReviewDiffCell = {
  lineNumber?: number;
  text: string;
  changeType: ReviewDiffCellChangeType;
};

type ReviewDiffRow = {
  left: ReviewDiffCell;
  right: ReviewDiffCell;
};

type ReviewDiffHunk = {
  header: string;
  rows: ReviewDiffRow[];
};

export type ReviewDiffFile = {
  path: string;
  oldPath?: string;
  newPath?: string;
  status: ReviewDiffFileStatus;
  hunks: ReviewDiffHunk[];
};
