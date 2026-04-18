import { useChatPanelAction } from '../action/useChatPanelAction';
import ChatComposer from '../parts/ChatComposer';
import ChatEventTimeline from '../parts/ChatEventTimeline';
import ChatHeader from '../parts/ChatHeader';
import AutoCheckSettingsModal from '../parts/AutoCheckSettingsModal';
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
    taskLifecycleActions,
    isDrawerOpen,
    isSettingsModalOpen,
    workspaceLabel,
    currentBranch,
    bootError,
    draft,
    autoCheckForm,
    reviewTab,
    reviewDiffFiles,
    isReviewDiffLoading,
    reviewError,
    reviewCommitMessage,
    isReviewCommitRunning,
    isPlanRevisionMode,
    isTaskWorkspaceInitializing,
    setDraft,
    setReviewCommitMessage,
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
  const drawerActions =
    displayStatus.phase === 'before_start' ||
    displayStatus.phase === 'awaiting_confirmation'
      ? []
      : taskLifecycleActions;
  const composerDecisionActions =
    displayStatus.phase === 'before_start' ||
    displayStatus.phase === 'awaiting_confirmation'
      ? taskLifecycleActions
      : [];
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
      isPlanRevisionMode={isPlanRevisionMode}
      onDraftChange={setDraft}
      onSend={() => void handleSend()}
      onStop={() => void handleAbort()}
      onDecisionAction={(action) => void handleTaskLifecycleAction(action)}
    />
  );
  const isReviewMode = activeTask?.lifecycleState === 'awaiting_review';
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
                onTabChange={handleReviewTabChange}
                onCommitMessageChange={setReviewCommitMessage}
                onCommit={() => void handleReviewCommit()}
                chatTimeline={chatTimeline}
                chatComposer={chatComposer}
              />
            ) : null
          }
          timeline={isReviewMode ? undefined : chatTimeline}
          composer={isReviewMode ? undefined : chatComposer}
          maxWidthClassName={isReviewMode ? 'max-w-[1400px]' : undefined}
        />
      </div>
    </div>
  );
}
