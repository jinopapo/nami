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
    taskCreationOptions,
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
    setTaskCreationOptions,
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
  const isCreatingTask = !activeTask && isDrawerOpen;
  const isCustomBranchMode = Boolean(taskCreationOptions.taskBranchName.trim());
  const taskCreationPanel = isCreatingTask ? (
    <div className="border-b border-slate-400/10 px-5 py-4 md:px-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-medium text-slate-400">
            作業ブランチ
          </span>
          <input
            className="h-10 rounded-xl border border-slate-400/12 bg-slate-950/45 px-3 text-sm text-slate-100 outline-none transition focus:border-amber-400/45"
            value={taskCreationOptions.taskBranchName}
            onChange={(event) =>
              setTaskCreationOptions((current) => ({
                ...current,
                taskBranchName: event.target.value,
              }))
            }
            placeholder="未指定なら task/{id} を自動生成"
          />
        </label>
        <label className="flex min-h-10 items-center gap-3 rounded-xl border border-slate-400/12 bg-slate-950/35 px-3 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-amber-500"
            checked={!isCustomBranchMode}
            disabled
            onChange={() => undefined}
          />
          {isCustomBranchMode
            ? '作業ブランチ指定時はブランチを保持して PR を作成'
            : 'レビュー後にベースブランチへマージ'}
        </label>
      </div>
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
              taskCreationPanel
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
