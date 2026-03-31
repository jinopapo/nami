type ChatComposerProps = {
  draft: string;
  mode: 'plan' | 'act';
  statusPhase: 'idle' | 'running' | 'waiting_permission';
  statusLabel: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
};

export default function ChatComposer({
  draft,
  mode,
  statusPhase,
  statusLabel,
  onDraftChange,
  onSend,
  onStop,
}: ChatComposerProps) {
  const isRunning = statusPhase === 'running';
  const isWaiting = statusPhase === 'waiting_permission';
  const isSendDisabled = isRunning || isWaiting || !draft.trim();
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !event.metaKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (isSendDisabled) {
      return;
    }

    onSend();
  };
  const actionButtonClassName = isRunning
    ? 'min-w-[104px] rounded-full bg-slate-400/14 px-3.5 py-2.5 text-inherit transition duration-150 ease-out hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60'
    : 'min-w-[104px] rounded-full bg-linear-to-br from-amber-500 to-orange-400 px-3.5 py-2.5 font-bold text-slate-900 transition duration-150 ease-out hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="mx-3 mb-3 mt-0 flex shrink-0 flex-col gap-3 rounded-[28px] border border-slate-400/14 bg-[rgba(12,19,31,0.96)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.3)] md:mx-5 md:mb-5">
      <textarea
        className="min-h-28 w-full resize-none border-0 bg-transparent p-0 text-inherit outline-none disabled:cursor-not-allowed disabled:opacity-60"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="変更したいことを入力"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-slate-400/15 px-3 py-1.5 text-sm capitalize text-slate-300">
          {statusPhase === 'idle' ? mode : statusLabel}
        </span>
        {isRunning ? (
          <button className={actionButtonClassName} onClick={onStop}>
            Stop
          </button>
        ) : (
          <button className={actionButtonClassName} disabled={isSendDisabled} onClick={onSend}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}