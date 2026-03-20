import { useChatPanelAction } from '../action/useChatPanelAction';
import { extractMessageText, type UiEvent } from '../model/chat';
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
    default:
      return 'Idle';
  }
};

const renderEvent = (
  event: UiEvent,
  handleApproval: (approvalId: string, decision: 'approve' | 'reject') => Promise<void>,
) => {
  if (event.type === 'sessionUpdate' && (event.update.sessionUpdate === 'user_message_chunk' || event.update.sessionUpdate === 'agent_message_chunk')) {
    const role = event.update.sessionUpdate === 'user_message_chunk' ? 'user' : 'assistant';
    const authorLabel = role === 'user' ? 'You' : 'Nami';
    const text = extractMessageText(event.update) ?? '';
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

  if (
    event.type === 'permissionRequest'
  ) {
    const approval = event;

    return (
      <article key={`${event.timestamp}-${event.approvalId}`} className="eventCard event-approval event-compact">
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>Approval required</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="m-0">{approval.request.toolCall.title ?? 'Permission required'}</p>
        <div className="approvalActions">
          <button onClick={() => void handleApproval(approval.approvalId, 'approve')}>Approve</button>
          <button onClick={() => void handleApproval(approval.approvalId, 'reject')}>Reject</button>
        </div>
      </article>
    );
  }

  if (event.type === 'sessionUpdate' && event.update.sessionUpdate === 'plan' && Array.isArray(event.update.entries)) {
    return (
      <article key={`${event.timestamp}-plan`} className="eventCard event-plan event-compact">
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>Plan updated</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {event.update.entries.map((entry, index) => {
            if (!entry || typeof entry !== 'object') {
              return null;
            }

            const item = entry as { content?: string; status?: string };
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

  if (event.type === 'sessionUpdate' && (event.update.sessionUpdate === 'tool_call' || event.update.sessionUpdate === 'tool_call_update')) {
    const textContent = event.update.content
      ?.map((item) => (item.type === 'content' && item.content.type === 'text' ? item.content.text : null))
      .filter(Boolean)
      .join('\n');
    return (
      <article key={`${event.timestamp}-${event.update.toolCallId}`} className="eventCard event-tool event-compact">
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>{event.update.title ?? 'Tool call'}</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="eventDetail">{typeof event.update.status === 'string' ? getStatusLabel(event.update.status) : 'Running tool'}</p>
        {textContent ? <p className="mt-2 m-0">{textContent}</p> : null}
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
