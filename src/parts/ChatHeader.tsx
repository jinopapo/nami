type ChatHeaderProps = {
  title: string;
  selectedSessionId?: string;
  workspaceLabel: string;
  bootError: string | null;
  onChooseDirectory: () => void;
  onStop: () => void;
};

export default function ChatHeader({
  title,
  selectedSessionId,
  workspaceLabel,
  bootError,
  onChooseDirectory,
  onStop,
}: ChatHeaderProps) {
  return (
    <section className="chatHeaderPanel panel">
      <div className="panelHeader chatHeader">
        <div className="chatHeaderTitle">
          <p className="eyebrow">Conversation</p>
          <h2>{title}</h2>
        </div>
        <div className="chatHeaderActions">
          <div className="workspaceBadge">
            <span className="workspaceBadgeLabel">Workspace</span>
            <span className={`pathLabel ${workspaceLabel === 'No directory selected' ? 'placeholder' : ''}`}>
              {workspaceLabel}
            </span>
          </div>
          <button className="secondaryButton" type="button" onClick={onChooseDirectory}>
            Choose Directory
          </button>
          <button className="secondaryButton" disabled={!selectedSessionId} onClick={onStop}>
            Stop
          </button>
        </div>
      </div>
      {bootError ? <p className="errorText">{bootError}</p> : null}
    </section>
  );
}
