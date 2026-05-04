import { useChatPanelAction } from '../action/useChatPanelAction';
import ChatComposer from '../parts/ChatComposer';
import ChatEventTimeline from '../parts/ChatEventTimeline';
import ChatHeader from '../parts/ChatHeader';
import AutoCheckSettingsModal from '../parts/AutoCheckSettingsModal';
import TaskCreationOptionsPanel from '../parts/TaskCreationOptionsPanel';
import TaskDependencyPanel from '../parts/TaskDependencyPanel';
import TaskBoard from '../parts/TaskBoard';
import TaskDetailDrawer from '../parts/TaskDetailDrawer';
import ReviewDetailPanel from '../parts/ReviewDetailPanel';

export default function ChatPanelContainer() {
  const {
    activeTask,
    displayItems,
    timelineAutoScrollState,
    displayStatus,
    boardColumns,
    activeTitle,
    drawerActions,
    composerDecisionActions,
    retryAction,
    isDrawerOpen,
    isSettingsModalOpen,
    isTaskCreationOptionsExpanded,
    workspaceLabel,
    currentBranch,
    bootError,
    draft,
    taskCreationOptions,
    createDependencyOptions,
    activeTaskDependencyOptions,
    taskDependencyDraftTaskIds,
    isTaskDependencyPanelVisible,
    isTaskDependencyEditable,
    hasTaskDependencyChanges,
    isSavingTaskDependencies,
    autoCheckForm,
    reviewTab,
    reviewDiffFiles,
    isReviewDiffLoading,
    reviewError,
    reviewCommitMessage,
    isReviewCommitRunning,
    isPlanRevisionMode,
    isPlanningTransitionInitializing,
    isTaskWorkspaceInitializing,
    setDraft,
    setTaskCreationOptions,
    setIsTaskCreationOptionsExpanded,
    setReviewCommitMessage,
    handleToggleTaskCreationDependency,
    handleToggleTaskDependency,
    handleSaveTaskDependencies,
    handleChooseDirectory,
    handleOpenWindow,
    handleCreateTask,
    handleOpenTask,
    handleCloseDrawer,
    handleOpenSettingsModal,
    handleCloseSettingsModal,
    handleSend,
    handleApproval,
    handleAbort,
    handleTaskLifecycleAction,
    handleReviewTabChange,
    handleReviewCommit,
    handleAutoCheckEnabledChange,
    handleAutoCheckStepChange,
    handleAutoCheckAddStep,
    handleAutoCheckRemoveStep,
    handleSaveAutoCheck,
    handleRunAutoCheck,
  } = useChatPanelAction();

  const { shouldAutoScroll, autoScrollKey } = timelineAutoScrollState;
  const chatTimeline = (
    <ChatEventTimeline
      displayItems={displayItems}
      shouldAutoScroll={shouldAutoScroll}
      autoScrollKey={autoScrollKey}
      onApproval={handleApproval}
    />
  );
  const chatComposer = (
    <ChatComposer
      draft={draft}
      statusPhase={displayStatus.phase}
      decisionActions={composerDecisionActions}
      retryAction={retryAction}
      isPlanRevisionMode={isPlanRevisionMode}
      isPlanningTransitionInitializing={isPlanningTransitionInitializing}
      onDraftChange={setDraft}
      onSend={() => void handleSend()}
      onStop={() => void handleAbort()}
      onDecisionAction={(action) => void handleTaskLifecycleAction(action)}
    />
  );
  const isReviewMode = activeTask?.lifecycleState === 'awaiting_review';
  const isCreatingTask = !activeTask && isDrawerOpen;
  const taskCreationPanel = isCreatingTask ? (
    <TaskCreationOptionsPanel
      isExpanded={isTaskCreationOptionsExpanded}
      taskBranchName={taskCreationOptions.taskBranchName}
      dependencyOptions={createDependencyOptions}
      selectedDependencyTaskIds={taskCreationOptions.dependencyTaskIds}
      isDependencyDisabled={Boolean(taskCreationOptions.taskBranchName.trim())}
      dependencyDisabledMessage={
        taskCreationOptions.taskBranchName.trim()
          ? 'カスタムブランチを指定したタスクは依存関係を持てません。'
          : undefined
      }
      onToggleExpanded={() =>
        setIsTaskCreationOptionsExpanded((current) => !current)
      }
      onTaskBranchNameChange={(taskBranchName) =>
        setTaskCreationOptions((current) => ({
          ...current,
          taskBranchName,
        }))
      }
      onToggleDependency={handleToggleTaskCreationDependency}
    />
  ) : null;
  const taskDependencyPanel =
    activeTask && isTaskDependencyPanelVisible ? (
      <div className="border-b border-slate-400/10 px-5 py-4 md:px-6">
        <TaskDependencyPanel
          title="依存タスク"
          description={`未解決の依存: ${activeTask.pendingDependencyTaskIds.length} 件 / 設定済み: ${activeTask.dependencyTaskIds.length} 件`}
          badgeLabel={`${taskDependencyDraftTaskIds.length} 件選択中`}
          options={activeTaskDependencyOptions}
          selectedTaskIds={taskDependencyDraftTaskIds}
          emptyMessage="依存先に選べる既存タスクはまだありません。"
          disabled={!isTaskDependencyEditable}
          disabledMessage={
            isTaskDependencyEditable
              ? undefined
              : '依存関係を編集できるのは、未開始の merge_to_base タスクだけです。'
          }
          saveLabel="依存関係を保存"
          isSaving={isSavingTaskDependencies}
          isSaveDisabled={!hasTaskDependencyChanges}
          onToggle={handleToggleTaskDependency}
          onSave={() => void handleSaveTaskDependencies()}
        />
      </div>
    ) : null;
  return (
    <div className="mx-auto flex w-full max-w-[min(2200px,calc(100vw-24px))] flex-col gap-4">
      <ChatHeader
        workspaceLabel={workspaceLabel}
        currentBranch={currentBranch}
        bootError={bootError}
        isSettingsAvailable={Boolean(
          workspaceLabel && workspaceLabel !== 'No directory selected',
        )}
        onChooseDirectory={() => void handleChooseDirectory()}
        onOpenWindow={() => void handleOpenWindow()}
        onOpenSettings={handleOpenSettingsModal}
      />
      <AutoCheckSettingsModal
        isOpen={isSettingsModalOpen}
        isAvailable={Boolean(
          workspaceLabel && workspaceLabel !== 'No directory selected',
        )}
        workspaceLabel={workspaceLabel}
        enabled={autoCheckForm.enabled}
        steps={autoCheckForm.steps}
        isDirty={autoCheckForm.isDirty}
        isSaving={autoCheckForm.isSaving}
        isRunning={autoCheckForm.isRunning}
        lastResult={autoCheckForm.lastResult}
        onClose={handleCloseSettingsModal}
        onEnabledChange={handleAutoCheckEnabledChange}
        onStepChange={handleAutoCheckStepChange}
        onAddStep={handleAutoCheckAddStep}
        onRemoveStep={handleAutoCheckRemoveStep}
        onSave={() => void handleSaveAutoCheck()}
        onRun={() => void handleRunAutoCheck()}
      />
      <div className="flex h-[calc(100vh-150px)] min-h-[560px] flex-col">
        <TaskBoard
          columns={boardColumns}
          selectedTaskId={activeTask?.taskId}
          workspaceLabel={workspaceLabel}
          onCreateTask={handleCreateTask}
          onOpenTask={handleOpenTask}
        />
        <TaskDetailDrawer
          isOpen={isDrawerOpen}
          task={activeTask}
          title={activeTitle}
          subtitle={
            isTaskWorkspaceInitializing
              ? 'タスクワークスペースを準備しています。完了まで少しお待ちください。'
              : activeTask
                ? activeTask.cwd
                : '最初のプロンプトを入れて、新しいタスクをカンバンに追加します。'
          }
          statusLabel={displayStatus.label}
          statusTone={displayStatus.tone}
          actions={drawerActions}
          onAction={(action) => void handleTaskLifecycleAction(action)}
          onClose={handleCloseDrawer}
          topPanel={
            isReviewMode ? (
              <ReviewDetailPanel
                activeTab={reviewTab}
                diffFiles={reviewDiffFiles}
                isLoading={isReviewDiffLoading}
                error={reviewError}
                commitMessage={reviewCommitMessage}
                isCommitting={isReviewCommitRunning}
                canMergeAfterReview={activeTask?.canMergeAfterReview ?? true}
                onTabChange={handleReviewTabChange}
                onCommitMessageChange={setReviewCommitMessage}
                onCommit={() => void handleReviewCommit()}
                chatTimeline={chatTimeline}
                chatComposer={chatComposer}
              />
            ) : (
              (taskCreationPanel ?? taskDependencyPanel)
            )
          }
          timeline={isReviewMode ? undefined : chatTimeline}
          composer={isReviewMode ? undefined : chatComposer}
          maxWidthClassName={isReviewMode ? 'max-w-[1400px]' : undefined}
        />
      </div>
    </div>
  );
}
