import type { ReactNode } from 'react';

type ChatPanelProps = {
  activeSession?: {
    live: boolean;
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
  const isComposerDisabled = !selectedSessionId || !activeSession?.live;
  const isSendDisabled = isComposerDisabled || !draft.trim();

  return (
    <section className="chat panel">
      <div className="chatPanelIntro">
        <p className="eyebrow">Conversation</p>
        <h2>{selectedSessionId ? 'Ask Nami to work on your codebase' : 'Select or create a session to start chatting'}</h2>
      </div>
      <div className="timeline">
        {timeline}
      </div>
      <div className="composer">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Describe the change you want the agent to make..."
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
