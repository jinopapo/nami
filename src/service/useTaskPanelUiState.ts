import { useState } from 'react';

type UseTaskPanelUiStateInput<TTaskCreationOptions> = {
  cwd: string;
  createDefaultTaskCreationOptions: () => TTaskCreationOptions;
  clearSelectedTask: () => void;
  setDraft: (draft: string) => void;
  selectTask: (taskId: string) => void;
};

export const useTaskPanelUiState = <TTaskCreationOptions>(
  input: UseTaskPanelUiStateInput<TTaskCreationOptions>,
) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTaskCreationOptionsExpanded, setIsTaskCreationOptionsExpanded] =
    useState(false);
  const [taskCreationOptions, setTaskCreationOptions] = useState(
    input.createDefaultTaskCreationOptions,
  );

  const openDrawer = () => setIsDrawerOpen(true);

  const handleCreateTask = () => {
    input.clearSelectedTask();
    input.setDraft('');
    setIsTaskCreationOptionsExpanded(false);
    setTaskCreationOptions(input.createDefaultTaskCreationOptions());
    openDrawer();
  };

  const handleOpenTask = (taskId: string) => {
    input.selectTask(taskId);
    openDrawer();
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    input.clearSelectedTask();
  };

  const handleOpenSettingsModal = () => {
    if (input.cwd) {
      setIsSettingsModalOpen(true);
    }
  };

  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false);

  return {
    isDrawerOpen,
    isSettingsModalOpen,
    isTaskCreationOptionsExpanded,
    taskCreationOptions,
    setTaskCreationOptions,
    setIsTaskCreationOptionsExpanded,
    openDrawer,
    handleCreateTask,
    handleOpenTask,
    handleCloseDrawer,
    handleOpenSettingsModal,
    handleCloseSettingsModal,
  };
};
