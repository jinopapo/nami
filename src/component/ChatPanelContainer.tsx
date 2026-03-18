import { useChatPanelAction } from '../action/useChatPanelAction';
import ChatHeader from '../parts/ChatHeader';
import ChatPanel from '../parts/ChatPanel';

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export default function ChatPanelContainer() {
  const {
    selectedSessionId,
    activeSession,
    activeEvents,
    workspaceLabel,
    bootError,
    draft,
    sending,
    setDraft,
    handleChooseDirectory,
    handleSend,
    handleApproval,
    handleAbort,
  } = useChatPanelAction();

  const timeline = activeEvents.length > 0
    ? activeEvents.map((event) => (
      <article key={event.id} className={`eventCard event-${event.type}`}>
        <header>
          <strong>
            {event.type === 'message'
              ? `${String(event.role === 'user' ? 'user' : 'assistant')} message`
              : event.type}
          </strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        {'text' in event ? <p>{String(event.text)}</p> : null}
        {'status' in event ? <p>{String(event.status)} {event.detail ? `· ${String(event.detail)}` : ''}</p> : null}
        {'entries' in event ? (
          <ul>{event.entries.map((entry) => <li key={`${event.id}-${String(entry.content)}`}>{String(entry.status)}: {String(entry.content)}</li>)}</ul>
        ) : null}
        {'title' in event ? <p>{String(event.title)}</p> : null}
        {'contentText' in event && typeof event.contentText === 'string' ? <p>{event.contentText}</p> : null}
        {'diff' in event ? (
          <ul>{event.diff.items.map((item) => <li key={`${event.id}-${String(item.path)}`}>{String(item.path)} · {String(item.summary)}</li>)}</ul>
        ) : null}
        {'approval' in event ? (
          <div className="approvalActions">
            <p>{String(event.approval.title)}</p>
            <button onClick={() => void handleApproval(String(event.approval.approvalId), 'approve')}>Approve</button>
            <button onClick={() => void handleApproval(String(event.approval.approvalId), 'reject')}>Reject</button>
          </div>
        ) : null}
        {'message' in event ? <p className="errorText">{String(event.message)}</p> : null}
      </article>
    ))
    : [<article key="empty" className="eventCard"><p>まだメッセージはありません。</p></article>];

  return (
    <div className="chatLayout">
      <ChatHeader
        title={activeSession?.title ?? 'No Session Selected'}
        selectedSessionId={selectedSessionId}
        workspaceLabel={workspaceLabel}
        bootError={bootError}
        onChooseDirectory={() => void handleChooseDirectory()}
        onStop={() => void handleAbort()}
      />
      <ChatPanel
        activeSession={activeSession}
        selectedSessionId={selectedSessionId}
        draft={draft}
        sending={sending}
        timeline={timeline}
        onDraftChange={setDraft}
        onSend={() => void handleSend()}
      />
    </div>
  );
}
