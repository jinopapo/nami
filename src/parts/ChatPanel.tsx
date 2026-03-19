import type { ReactNode } from 'react';

type ChatPanelProps = {
  activeSession?: {
    live: boolean;
    archived?: boolean;
    mode: 'plan' | 'act';
  };
  selectedSessionId?: string;
  draft: string;
  isTaskRunning: boolean;
  timeline: ReactNode;
  onStop: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
};

export default function ChatPanel({
  activeSession,
  selectedSessionId,
  draft,
  isTaskRunning,
  timeline,
  onStop,
  onDraftChange,
  onSend,
}: ChatPanelProps) {
  const isComposerDisabled = !selectedSessionId || !activeSession?.live || activeSession?.archived;
  const isSendDisabled = isComposerDisabled || !draft.trim();

  return (
    <section className="chatShell panel">
      <div className="chatIntro">
        <p className="eyebrow">Conversation</p>
        <h2 className="mt-1 text-[clamp(1.1rem,2vw,1.45rem)] font-semibold tracking-[-0.02em]">
          {selectedSessionId ? 'Nami と会話しながらコードベースを編集できます' : 'セッションを選ぶと会話を開始できます'}
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
          <span className="modeBadge">{activeSession?.mode ?? 'plan'} mode</span>
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
