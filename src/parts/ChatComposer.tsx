type ChatComposerProps = {
  draft: string;
  mode: 'plan' | 'act';
  isTaskRunning: boolean;
  isWaiting: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
};

export default function ChatComposer({
  draft,
  mode,
  isTaskRunning,
  isWaiting,
  onDraftChange,
  onSend,
  onStop,
}: ChatComposerProps) {
  const isSendDisabled = isTaskRunning || isWaiting || !draft.trim();
  const isStopDisabled = isWaiting;

  return (
    <div className="composer">
      <textarea
        className="composerTextarea"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="変更したいことを入力"
      />
      <div className="composerFooter">
        <span className="modeBadge">{mode}</span>
        {isTaskRunning ? (
          <button className="secondaryButton composerButton" disabled={isStopDisabled} onClick={onStop}>
            Stop
          </button>
        ) : (
          <button className="primaryButton composerButton" disabled={isSendDisabled} onClick={onSend}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}