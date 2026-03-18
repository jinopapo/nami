import { useChatPanelAction } from '../action/useChatPanelAction';
import type { UiEvent } from '../model/chat';
import ChatHeader from '../parts/ChatHeader';
import ChatPanel from '../parts/ChatPanel';

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
      return 'Error';
    case 'archived':
      return 'Archived';
    default:
      return 'Idle';
  }
};

const renderEvent = (
  event: UiEvent,
  handleApproval: (approvalId: string, decision: 'approve' | 'reject') => Promise<void>,
) => {
  if (event.type === 'diffSummary') {
    return null;
  }

  if (event.type === 'message') {
    const role = event.role === 'user' ? 'user' : 'assistant';

    return (
      <article key={event.id} className={`messageBubble ${role}`}>
        <div className="messageMeta">
          <span className="messageRole">{role === 'user' ? 'You' : 'Nami'}</span>
          <span>{formatTime(event.timestamp)}</span>
        </div>
        <p>{typeof event.text === 'string' ? event.text : ''}</p>
      </article>
    );
  }

  if (
    event.type === 'approval'
    && event.approval
    && typeof event.approval === 'object'
    && 'approvalId' in event.approval
    && typeof event.approval.approvalId === 'string'
  ) {
    const approval = event.approval as {
      approvalId: string;
      title?: string;
      resolved?: boolean;
      decision?: string;
    };

    return (
      <article key={event.id} className="eventCard event-approval event-compact">
        <header>
          <strong>Approval required</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p>{approval.title ?? 'Permission required'}</p>
        {approval.resolved ? <p className="eventDetail">Resolved: {approval.decision ?? 'updated'}</p> : null}
        {!approval.resolved ? (
          <div className="approvalActions">
            <button onClick={() => void handleApproval(approval.approvalId, 'approve')}>Approve</button>
            <button onClick={() => void handleApproval(approval.approvalId, 'reject')}>Reject</button>
          </div>
        ) : null}
      </article>
    );
  }

  if (event.type === 'plan' && Array.isArray(event.entries)) {
    return (
      <article key={event.id} className="eventCard event-plan event-compact">
        <header>
          <strong>Plan updated</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <ul className="eventList">
          {event.entries.map((entry, index) => {
            if (!entry || typeof entry !== 'object') {
              return null;
            }

            const item = entry as { content?: string; status?: string };
            return (
              <li key={`${event.id}-${index}`}>
                <span className="eventListStatus">{item.status ?? 'pending'}</span>
                <span>{item.content ?? ''}</span>
              </li>
            );
          })}
        </ul>
      </article>
    );
  }

  if (event.type === 'tool') {
    return (
      <article key={event.id} className="eventCard event-tool event-compact">
        <header>
          <strong>{typeof event.title === 'string' ? event.title : 'Tool call'}</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="eventDetail">{typeof event.status === 'string' ? getStatusLabel(event.status) : 'Running tool'}</p>
        {typeof event.contentText === 'string' && event.contentText ? <p>{event.contentText}</p> : null}
      </article>
    );
  }

  if (event.type === 'status') {
    return (
      <article key={event.id} className="eventCard event-status event-compact">
        <header>
          <strong>{getStatusLabel(typeof event.status === 'string' ? event.status : undefined)}</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        {typeof event.detail === 'string' && event.detail ? <p className="eventDetail">{event.detail}</p> : null}
      </article>
    );
  }

  if (event.type === 'error') {
    return (
      <article key={event.id} className="eventCard event-error event-compact">
        <header>
          <strong>Error</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="errorText">{typeof event.message === 'string' ? event.message : 'Unknown error'}</p>
      </article>
    );
  }

  return (
    <article key={event.id} className={`eventCard event-${event.type} event-compact`}>
      <header>
        <strong>{event.type}</strong>
        <span>{formatTime(event.timestamp)}</span>
      </header>
    </article>
  );
};

export default function ChatPanelContainer() {
  const {
    selectedSessionId,
    activeSession,
    activeEvents,
    isTaskRunning,
    workspaceLabel,
    bootError,
    draft,
    setDraft,
    handleChooseDirectory,
    handleSend,
    handleApproval,
    handleAbort,
  } = useChatPanelAction();

  const timelineItems = activeEvents
    .map((event) => renderEvent(event, handleApproval))
    .filter(Boolean);

  const timeline = timelineItems.length > 0
    ? timelineItems
    : [(
      <article key="empty" className="emptyTimeline">
        <p className="emptyTimelineEyebrow">Ready when you are</p>
        <h3>Start with a concrete request for your codebase.</h3>
        <p>Ask for a refactor, bug fix, UI adjustment, or investigation.</p>
      </article>
    )];

  return (
    <div className="chatLayout">
      <ChatHeader
        title={activeSession?.title ?? 'No Session Selected'}
        workspaceLabel={workspaceLabel}
        bootError={bootError}
        onChooseDirectory={() => void handleChooseDirectory()}
      />
      <ChatPanel
        activeSession={activeSession}
        selectedSessionId={selectedSessionId}
        draft={draft}
        isTaskRunning={isTaskRunning}
        timeline={timeline}
        onStop={() => void handleAbort()}
        onDraftChange={setDraft}
        onSend={() => void handleSend()}
      />
    </div>
  );
}
