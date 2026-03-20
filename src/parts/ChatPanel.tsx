import type { ReactNode } from 'react';

type ChatPanelProps = {
  activeTask?: {
    mode: 'plan' | 'act';
  };
  selectedTaskId?: string;
  draft: string;
  isTaskRunning: boolean;
  displayStatus: {
    label: string;
    tone: 'running' | 'waiting' | 'completed' | 'idle';
  };
  phaseLabel: string;
  phaseDescription: string;
  actionMessage?: string;
  latestPermissionRequestTitle?: string;
  timeline: ReactNode;
  onStop: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
};

export default function ChatPanel({
  activeTask,
  selectedTaskId,
  draft,
  isTaskRunning,
  displayStatus,
  phaseLabel,
  phaseDescription,
  actionMessage,
  latestPermissionRequestTitle,
  timeline,
  onStop,
  onDraftChange,
  onSend,
}: ChatPanelProps) {
  const isComposerDisabled = false;
  const isSendDisabled = isTaskRunning || displayStatus.tone === 'waiting' || !draft.trim();
  const isStopDisabled = displayStatus.tone === 'waiting';
  const helperText = displayStatus.tone === 'waiting'
    ? latestPermissionRequestTitle ?? actionMessage ?? '承認または入力待ちのため、対応が必要です。'
    : phaseDescription;

  return (
    <section className="chatShell panel">
      <div className="chatIntro">
        <div className="chatIntroTop">
          <div>
            <p className="eyebrow">Conversation</p>
            <h2 className="mt-1 text-[clamp(1.1rem,2vw,1.45rem)] font-semibold tracking-[-0.02em]">
              {selectedTaskId ? 'Nami と会話しながらコードベースを編集できます' : '依頼を送るとタスクを開始できます'}
            </h2>
          </div>
          <span className={`statusBadge ${displayStatus.tone}`}>{displayStatus.label}</span>
        </div>
        <div className="phaseSummary">
          <strong className="phaseLabel">{phaseLabel}</strong>
          <p className="chatIntroHelper">{helperText}</p>
          {actionMessage ? <p className="phaseAction">{actionMessage}</p> : null}
        </div>
      </div>
      <div className="chatTimeline">
        {timeline}
      </div>
      <div className="composer">
        <textarea
          className="composerTextarea"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Nami に依頼したい変更内容を入力してください"
          disabled={isComposerDisabled}
        />
        <div className="composerFooter">
          <div className="composerMeta">
            <span className="modeBadge">{activeTask?.mode ?? 'plan'} mode</span>
            <span className="composerHint">{isTaskRunning ? '実行中でも次の依頼を下書きできます' : 'Enter 相当の送信はボタンから行ってください'}</span>
          </div>
          {isTaskRunning ? (
            <button className="secondaryButton composerButton" disabled={isStopDisabled} onClick={onStop}>
              Stop
            </button>
          ) : (
            <button className="primaryButton composerButton" disabled={isSendDisabled} onClick={onSend}>
              Send
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
