import type { ReactNode } from 'react';

type ChatPanelProps = {
  displayStatus: {
    label: string;
    tone: 'running' | 'waiting' | 'completed' | 'idle';
  };
  timeline: ReactNode;
  composer: ReactNode;
};

export default function ChatPanel({
  displayStatus,
  timeline,
  composer,
}: ChatPanelProps) {
  const statusToneClassName = {
    idle: 'border-slate-400/16 bg-slate-400/12 text-slate-300',
    running: 'border-blue-500/28 bg-blue-500/14 text-blue-300',
    waiting: 'border-amber-500/28 bg-amber-500/16 text-orange-300',
    completed: 'border-green-500/24 bg-green-500/14 text-green-300',
  }[displayStatus.tone];

  return (
    <section className="flex h-[calc(100vh-150px)] min-h-[560px] flex-col overflow-hidden rounded-[30px] border border-slate-400/20 bg-[linear-gradient(180deg,rgba(10,16,27,0.97),rgba(8,14,23,0.94))] px-0 py-0 shadow-[0_24px_72px_rgba(0,0,0,0.28)] backdrop-blur-[18px]">
      <div className="flex items-center justify-end border-b border-slate-400/10 bg-white/2 px-5 py-3 md:px-6">
        <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${statusToneClassName}`}>
          {displayStatus.label}
        </span>
      </div>
      {timeline}
      {composer}
    </section>
  );
}
