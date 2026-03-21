import { useChatPanelAction } from '../action/useChatPanelAction';
import type { UiActivity, UiChatMessage } from '../model/chat';
import ChatHeader from '../parts/ChatHeader';
import ChatPanel from '../parts/ChatPanel';

type TimelineEntry =
  | { kind: 'message'; item: UiChatMessage }
  | { kind: 'activity'; item: UiActivity };

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const renderEvent = (
  entry: TimelineEntry,
  handleApproval: (approvalId: string, decision: 'approve' | 'reject') => Promise<void>,
) => {
  if (entry.kind === 'message') {
    const event = entry.item;
    const role = event.role;
    const text = event.text;
    const authorInitial = role === 'user' ? 'Y' : 'N';

    return (
      <div key={event.id} className={`messageRow ${role}`}>
        {role === 'assistant' ? <div className={`messageAvatar ${role}`}>{authorInitial}</div> : null}
        <article className={`messageBubble ${role}`}>
          <div className="messageMeta">
            <span>{formatTime(event.timestamp)}</span>
            {event.status !== 'sent' ? <span className="messageState">{event.status === 'streaming' ? 'streaming' : 'sending'}</span> : null}
          </div>
          <p className="messageText">{text}</p>
        </article>
        {role === 'user' ? <div className={`messageAvatar ${role}`}>{authorInitial}</div> : null}
      </div>
    );
  }

  const event = entry.item;

  if (event.type === 'permissionRequest') {
    return (
      <article key={`${event.timestamp}-${event.approvalId}`} className="eventCard event-approval event-compact">
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>Approval required</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="m-0">{event.title}</p>
        <div className="approvalActions">
          <button onClick={() => void handleApproval(event.approvalId, 'approve')}>Approve</button>
          <button onClick={() => void handleApproval(event.approvalId, 'reject')}>Reject</button>
        </div>
      </article>
    );
  }

  if (event.type === 'taskStateChanged') {
    if (event.state === 'running' || event.state === 'completed') {
      return null;
    }

    return (
      <article key={`${event.timestamp}-${event.state}`} className="eventCard event-status event-compact">
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>{event.state}</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        {typeof event.reason === 'string' && event.reason ? <p className="eventDetail">{event.reason}</p> : null}
      </article>
    );
  }

  if (event.type === 'plan') {
    return (
      <article key={`${event.timestamp}-plan`} className="eventCard event-plan event-compact">
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>Plan updated</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {event.entries.map((item, index) => {
            return (
              <li key={`${event.timestamp}-${index}`} className="flex items-start gap-2.5">
                <span className="min-w-[84px] shrink-0 text-amber-500 capitalize">{item.status ?? 'pending'}</span>
                <span>{item.content ?? ''}</span>
              </li>
            );
          })}
        </ul>
      </article>
    );
  }

  if (event.type === 'humanDecisionRequest') {
    return (
      <article key={`${event.timestamp}-${event.requestId}`} className="eventCard event-approval event-compact">
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>Human decision required</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="m-0">{event.title}</p>
        {event.description ? <p className="eventDetail mt-2">{event.description}</p> : null}
      </article>
    );
  }

  if (event.type === 'toolCall') {
    return (
      <article key={`${event.timestamp}-${event.toolCallId ?? event.title}`} className="eventCard event-tool event-compact">
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>{event.title}</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="eventDetail">{event.statusLabel}</p>
        {event.details ? <p className="mt-2 m-0">{event.details}</p> : null}
      </article>
    );
  }
  if (event.type === 'error') {
    return (
      <article key={`${event.timestamp}-error`} className="eventCard event-error event-compact">
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>Error</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="errorText">{typeof event.message === 'string' ? event.message : 'Unknown error'}</p>
      </article>
    );
  }

  return (
    <article key={`${event.type}-${event.timestamp}`} className={`eventCard event-${event.type} event-compact`}>
      <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
        <strong>{event.type}</strong>
        <span>{formatTime(event.timestamp)}</span>
      </header>
    </article>
  );
};

export default function ChatPanelContainer() {
  const {
    activeTask,
    activeSession,
    isTaskRunning,
    latestPermissionRequest,
    displayStatus,
    workspaceLabel,
    bootError,
    draft,
    setDraft,
    handleChooseDirectory,
    handleSend,
    handleApproval,
    handleAbort,
  } = useChatPanelAction();

  const timelineEntries = [
    ...(activeSession?.messages.map((item) => ({ kind: 'message' as const, item })) ?? []),
    ...(activeSession?.activities.map((item) => ({ kind: 'activity' as const, item })) ?? []),
  ].sort((left, right) => new Date(left.item.timestamp).getTime() - new Date(right.item.timestamp).getTime());

  const timelineItems = timelineEntries
    .map((entry) => renderEvent(entry, handleApproval))
    .filter(Boolean);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <ChatHeader
        workspaceLabel={workspaceLabel}
        bootError={bootError}
        onChooseDirectory={() => void handleChooseDirectory()}
      />
      <ChatPanel
        activeTask={activeTask}
        draft={draft}
        isTaskRunning={isTaskRunning}
        displayStatus={displayStatus}
        timelineItems={timelineItems}
        onStop={() => void handleAbort()}
        onDraftChange={setDraft}
        onSend={() => void handleSend()}
      />
    </div>
  );
}
