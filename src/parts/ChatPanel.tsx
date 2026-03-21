import type { ReactNode } from 'react';
import ChatComposer from './ChatComposer';
import ChatTimeline from './ChatTimeline';

type ChatPanelProps = {
  activeTask?: {
    mode: 'plan' | 'act';
  };
  draft: string;
  isTaskRunning: boolean;
  displayStatus: {
    label: string;
    tone: 'running' | 'waiting' | 'completed' | 'idle';
  };
  timelineItems: ReactNode[];
  onStop: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
};

export default function ChatPanel({
  activeTask,
  draft,
  isTaskRunning,
  displayStatus,
  timelineItems,
  onStop,
  onDraftChange,
  onSend,
}: ChatPanelProps) {
  return (
    <section className="chatShell panel">
      <div className="chatPanelHeader">
        <span className={`statusBadge ${displayStatus.tone}`}>{displayStatus.label}</span>
      </div>
      <ChatTimeline items={timelineItems} />
      <ChatComposer
        draft={draft}
        mode={activeTask?.mode ?? 'plan'}
        isTaskRunning={isTaskRunning}
        isWaiting={displayStatus.tone === 'waiting'}
        onDraftChange={onDraftChange}
        onSend={onSend}
        onStop={onStop}
      />
    </section>
  );
}
