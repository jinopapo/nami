type SidebarProps = {
  sessions: Array<{
    sessionId: string;
    title: string;
    live: boolean;
    archived?: boolean;
    cwd: string;
  }>;
  selectedSessionId?: string;
  title: string;
  cwd: string;
  workspaceLabel: string;
  bootError: string | null;
  onTitleChange: (value: string) => void;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onChooseDirectory: () => void;
};

export default function Sidebar({
  sessions,
  selectedSessionId,
  title,
  cwd,
  workspaceLabel,
  bootError,
  onTitleChange,
  onSelectSession,
  onCreateSession,
  onChooseDirectory,
}: SidebarProps) {
  return (
    <aside className="sidebar panel">
      <div className="panelHeader">
        <p className="eyebrow">Nami Agent</p>
        <h1>Agent Workspace</h1>
      </div>
      <label className="field">
        <span className="fieldLabel">
          <span>Workspace</span>
          <span className={`pathLabel ${cwd ? '' : 'placeholder'}`}>{workspaceLabel}</span>
        </span>
        <div className="fieldRow fieldRowSingle">
          <button className="secondaryButton" type="button" onClick={onChooseDirectory}>
            Choose Directory
          </button>
        </div>
      </label>
      <label className="field">
        <span>Session Title</span>
        <input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Feature work" />
      </label>
      <button className="primaryButton" disabled={!cwd} onClick={onCreateSession}>
        New Session
      </button>
      {bootError ? <p className="errorText">{bootError}</p> : null}
      <div className="sessionList">
        {sessions.map((session) => (
          <button
            key={session.sessionId}
            className={`sessionItem ${session.sessionId === selectedSessionId ? 'active' : ''}`}
            onClick={() => onSelectSession(session.sessionId)}
          >
            <strong>{session.title}</strong>
            <span>{session.archived ? 'archived' : session.live ? 'live' : 'inactive'}</span>
            <small>{session.cwd}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}