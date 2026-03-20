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

const renderEvent = (
  event: UiEvent,
  handleApproval: (approvalId: string, decision: 'approve' | 'reject') => Promise<void>,
) => {
  if (event.type === 'message') {
    const role = event.role;
    const authorLabel = role === 'user' ? 'You' : 'Nami';
    const text = event.text;
    const authorInitial = role === 'user' ? 'Y' : 'N';

    return (
      <div key={`${event.timestamp}-${role}-${text}`} className={`messageRow ${role}`}>
        {role === 'assistant' ? <div className={`messageAvatar ${role}`}>{authorInitial}</div> : null}
        <article className={`messageBubble ${role}`}>
          <div className="messageMeta">
            <span className="messageAuthor">{authorLabel}</span>
            <span>{formatTime(event.timestamp)}</span>
          </div>
          <p className="messageText">{text}</p>
        </article>
        {role === 'user' ? <div className={`messageAvatar ${role}`}>{authorInitial}</div> : null}
      </div>
    );
  }

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

  if (event.type === 'taskStateChanged') {
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
    selectedTaskId,
    activeTask,
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
        <h3>コードベースに対する具体的な依頼から始めましょう。</h3>
        <p>たとえば UI 修正、リファクタ、バグ修正、調査依頼などをそのまま送れます。</p>
      </article>
    )];

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <ChatHeader
        title={activeTask?.taskId ?? 'No Task Selected'}
        workspaceLabel={workspaceLabel}
        bootError={bootError}
        onChooseDirectory={() => void handleChooseDirectory()}
      />
      <ChatPanel
        activeTask={activeTask}
        selectedTaskId={selectedTaskId}
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
