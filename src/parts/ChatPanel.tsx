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
    <section className="panel flex min-h-[calc(100vh-160px)] flex-col gap-[18px] p-[18px] max-[1080px]:min-h-[calc(100vh-120px)]">
      <div>
        <p className="eyebrow">Conversation</p>
        <h2 className="mt-1 text-[clamp(1.2rem,2vw,1.6rem)] font-semibold tracking-[-0.02em]">
          {selectedSessionId ? 'Ask Nami to work on your codebase' : 'Select or create a session to start chatting'}
        </h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pr-1.5">
        {timeline}
      </div>
      <div className="composer">
        <textarea
          className="min-h-36 w-full resize-y border-0 bg-transparent p-0 text-inherit outline-none disabled:cursor-not-allowed disabled:opacity-60"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Describe the change you want the agent to make..."
          disabled={isComposerDisabled}
        />
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
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
