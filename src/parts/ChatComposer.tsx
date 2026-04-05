import type { TaskLifecycleAction } from '../service/taskLifecycleService';

type ChatComposerProps = {
  draft: string;
  mode: 'plan' | 'act';
  statusPhase: 'idle' | 'planning' | 'awaiting_confirmation' | 'executing' | 'auto_checking' | 'awaiting_review' | 'waiting_permission';
  statusLabel: string;
  decisionActions?: TaskLifecycleAction[];
  isPlanRevisionMode?: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onDecisionAction?: (action: TaskLifecycleAction) => void;
};

export default function ChatComposer({
  draft,
  mode,
  statusPhase,
  statusLabel,
  decisionActions = [],
  isPlanRevisionMode = false,
  onDraftChange,
  onSend,
  onStop,
  onDecisionAction,
}: ChatComposerProps) {
  const isRunning = statusPhase === 'planning' || statusPhase === 'executing' || statusPhase === 'auto_checking';
  const isWaiting = statusPhase === 'waiting_permission';
  const isAwaitingConfirmation = statusPhase === 'awaiting_confirmation';
  const isComposerLocked = isAwaitingConfirmation && !isPlanRevisionMode;
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
  const helperText = isWaiting
    ? '判断が必要です。ボタンで選択するか、補足があればメッセージを送信してください。'
    : statusPhase === 'awaiting_confirmation'
      ? isPlanRevisionMode
        ? '練り直したい内容を入力して送信してください。送信すると計画モードに戻ります。'
        : 'チャットを見ながら、実行するか練り直すかを選んでください。'
      : statusPhase === 'awaiting_review'
        ? '結果を確認して、必要なら追加の指示を送信してください。'
    : '⌘ + Enter で送信';

  return (
    <div className="mx-3 mb-3 mt-0 flex shrink-0 flex-col gap-3 rounded-[28px] border border-slate-400/14 bg-[rgba(12,19,31,0.96)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.3)] md:mx-5 md:mb-5">
      <textarea
        className="min-h-28 w-full resize-none border-0 bg-transparent p-0 text-inherit outline-none disabled:cursor-not-allowed disabled:opacity-60"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isComposerLocked ? '「計画を練り直す」を押すと、ここから修正依頼を送れます' : '変更したいことを入力'}
        disabled={isComposerLocked}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="inline-flex w-fit items-center rounded-full bg-slate-400/15 px-3 py-1.5 text-sm capitalize text-slate-300">
            {statusPhase === 'idle' ? mode : statusLabel}
          </span>
          <span className="text-xs text-slate-500">{helperText}</span>
        </div>
        {isRunning ? (
          <button className={actionButtonClassName} onClick={onStop}>
            Stop
          </button>
        ) : isAwaitingConfirmation && !isPlanRevisionMode ? (
          <div className="flex flex-wrap justify-end gap-2">
            {decisionActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={action.tone === 'primary'
                  ? 'min-w-[104px] rounded-full bg-linear-to-br from-amber-500 to-orange-400 px-3.5 py-2.5 font-bold text-slate-900 transition duration-150 ease-out hover:-translate-y-px'
                  : 'min-w-[104px] rounded-full bg-slate-400/14 px-3.5 py-2.5 text-inherit transition duration-150 ease-out hover:-translate-y-px'}
                onClick={() => onDecisionAction?.(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : (
          <button className={actionButtonClassName} disabled={isSendDisabled} onClick={onSend}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}