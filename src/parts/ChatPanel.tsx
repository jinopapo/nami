import type { ReactNode } from 'react';

type ChatPanelProps = {
  activeTask?: {
    mode: 'plan' | 'act';
  };
  selectedTaskId?: string;
  draft: string;
  isTaskRunning: boolean;
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
  timeline,
  onStop,
  onDraftChange,
  onSend,
}: ChatPanelProps) {
  const isComposerDisabled = false;
  const isSendDisabled = isComposerDisabled || !draft.trim();

  return (
    <section className="chatShell panel">
      <div className="chatIntro">
        <p className="eyebrow">Conversation</p>
        <h2 className="mt-1 text-[clamp(1.1rem,2vw,1.45rem)] font-semibold tracking-[-0.02em]">
          {selectedTaskId ? 'Nami と会話しながらコードベースを編集できます' : '依頼を送るとタスクを開始できます'}
        </h2>
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
          <span className="modeBadge">{activeTask?.mode ?? 'plan'} mode</span>
          {isTaskRunning ? (
            <button className="secondaryButton composerButton" disabled={isComposerDisabled} onClick={onStop}>
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
