import type { ReactNode } from 'react';

type ChatPanelProps = {
  activeSession?: {
    title: string;
    live: boolean;
  };
  selectedSessionId?: string;
  draft: string;
  sending: boolean;
  timeline: ReactNode;
  onStop: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
};

export default function ChatPanel({
  activeSession,
  selectedSessionId,
  draft,
  sending,
  timeline,
  onStop,
  onDraftChange,
  onSend,
}: ChatPanelProps) {
  return (
    <section className="chat panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>{activeSession?.title ?? 'No Session Selected'}</h2>
        </div>
        <button className="secondaryButton" disabled={!selectedSessionId} onClick={onStop}>
          Stop
        </button>
      </div>
      <div className="timeline">
        {timeline}
      </div>
      <div className="composer">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Describe the change you want the agent to make..."
          disabled={!selectedSessionId || !activeSession?.live}
        />
        <button className="primaryButton" disabled={!selectedSessionId || sending || !activeSession?.live} onClick={onSend}>
          {sending ? 'Working…' : 'Send'}
        </button>
      </div>
    </section>
  );
}