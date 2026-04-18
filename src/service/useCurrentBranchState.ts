import { useEffect, useState } from 'react';
import { taskRepository } from '../repository/taskRepository';

export const useCurrentBranchState = (cwd: string) => {
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);

  useEffect(() => {
    if (!cwd) {
      setCurrentBranch(null);
      return;
    }

    let cancelled = false;
    void taskRepository
      .getCurrentBranch({ cwd })
      .then((branch) => {
        if (!cancelled) {
          setCurrentBranch(branch || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentBranch(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cwd]);

  return { currentBranch };
};
