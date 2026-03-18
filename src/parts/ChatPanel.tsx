import type { ReactNode } from 'react';

type ChatPanelProps = {
  activeSession?: {
    live: boolean;
  };
  selectedSessionId?: string;
  draft: string;
  sending: boolean;
  timeline: ReactNode;
  onDraftChange: (value: string) => void;
  onSend: () => void;
};

export default function ChatPanel({
  activeSession,
  selectedSessionId,
  draft,
  sending,
  timeline,
  onDraftChange,
  onSend,
}: ChatPanelProps) {
  return (
    <section className="chat panel">
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
