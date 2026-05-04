export type ReviewDiffFile = {
  path: string;
  oldPath?: string;
  newPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  hunks: Array<{
    header: string;
    rows: Array<{
      left: {
        lineNumber?: number;
        text: string;
        changeType: 'context' | 'added' | 'removed' | 'empty';
      };
      right: {
        lineNumber?: number;
        text: string;
        changeType: 'context' | 'added' | 'removed' | 'empty';
      };
    }>;
  }>;
};
