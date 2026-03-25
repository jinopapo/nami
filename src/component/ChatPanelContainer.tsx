import { useChatPanelAction } from '../action/useChatPanelAction';
import type { DisplayItem } from '../model/chat';
import ChatComposer from '../parts/ChatComposer';
import ChatHeader from '../parts/ChatHeader';
import ChatTimeline from '../parts/ChatTimeline';

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const renderJsonBlock = (label: string, value: unknown) => {
  if (value === undefined) {
    return null;
  }

  return (
    <section className="mt-3">
      <p className="m-0 mb-1 text-xs uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <pre className="m-0 overflow-x-auto rounded-xl bg-black/20 p-3 text-xs text-slate-300 whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
};

const renderEvent = (
  event: DisplayItem,
  handleApproval: (approvalId: string, decision: 'approve' | 'reject') => Promise<void>,
) => {
  if (event.type === 'userMessage' || event.type === 'assistantMessage') {
    const role = event.role;
    const text = event.text;
    const authorInitial = role === 'user' ? 'Y' : 'N';
    const isUser = role === 'user';
    const rowClassName = `flex w-full items-start gap-3 ${isUser ? 'justify-end' : ''}`;
    const avatarClassName = `flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-400/18 text-sm font-semibold ${
      isUser
        ? 'bg-slate-700/92 text-slate-200'
        : 'bg-[linear-gradient(135deg,rgba(245,158,11,0.22),rgba(251,146,60,0.3))] text-orange-300'
    }`;
    const bubbleClassName = `min-w-0 max-w-[min(820px,calc(100%-56px))] rounded-[24px] border border-slate-400/12 px-5 py-4 leading-[1.7] ${
      isUser
        ? 'ml-auto rounded-br-[8px] bg-[linear-gradient(180deg,rgba(51,65,85,0.9),rgba(30,41,59,0.92))] shadow-[0_12px_32px_rgba(15,23,42,0.26)]'
        : 'rounded-bl-[8px] bg-slate-950/70'
    }`;

    return (
      <div key={event.id} className={rowClassName}>
        {role === 'assistant' ? <div className={avatarClassName}>{authorInitial}</div> : null}
        <article className={bubbleClassName}>
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
            <span>{formatTime(event.timestamp)}</span>
            {event.status !== 'sent' ? (
              <span className="rounded-full bg-slate-400/15 px-2 py-0.5 text-[0.72rem] uppercase tracking-[0.08em] text-slate-300">
                {event.status === 'streaming' ? 'streaming' : 'sending'}
              </span>
            ) : null}
          </div>
          <p className="m-0 whitespace-pre-wrap break-words text-[0.98rem] text-slate-100">{text}</p>
        </article>
        {role === 'user' ? <div className={avatarClassName}>{authorInitial}</div> : null}
      </div>
    );
  }

  if (event.type === 'permissionRequest') {
    return (
      <article
        key={`${event.timestamp}-${event.approvalId}`}
        className="max-w-[min(820px,100%)] rounded-[18px] border border-pink-400/32 bg-[rgba(71,20,48,0.24)] px-[18px] py-4 text-slate-300"
      >
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>Approval required</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="m-0">{event.title}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="rounded-full bg-slate-400/14 px-3.5 py-2.5 text-inherit transition duration-150 ease-out hover:-translate-y-px"
            onClick={() => void handleApproval(event.approvalId, 'approve')}
          >
            Approve
          </button>
          <button
            className="rounded-full bg-slate-400/14 px-3.5 py-2.5 text-inherit transition duration-150 ease-out hover:-translate-y-px"
            onClick={() => void handleApproval(event.approvalId, 'reject')}
          >
            Reject
          </button>
        </div>
      </article>
    );
  }

  if (event.type === 'taskStateChanged') {
    if (event.state === 'running' || event.state === 'completed') {
      return null;
    }

    return (
      <article
        key={`${event.timestamp}-${event.state}`}
        className="max-w-[min(820px,100%)] rounded-[18px] border border-slate-400/10 bg-slate-900/55 px-[18px] py-4 text-slate-300"
      >
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>{event.state}</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        {typeof event.reason === 'string' && event.reason ? <p className="m-0 text-slate-400">{event.reason}</p> : null}
      </article>
    );
  }

  if (event.type === 'plan') {
    return null;
  }

  if (event.type === 'humanDecisionRequest') {
    return (
      <article
        key={`${event.timestamp}-${event.requestId}`}
        className="max-w-[min(820px,100%)] rounded-[18px] border border-pink-400/32 bg-[rgba(71,20,48,0.24)] px-[18px] py-4 text-slate-300"
      >
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>Human decision required</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="m-0">{event.title}</p>
        {event.description ? <p className="mt-2 m-0 text-slate-400">{event.description}</p> : null}
      </article>
    );
  }

  if (event.type === 'toolCall') {
    const readDisplay = event.display.variant === 'read' ? event.display : undefined;

    if (readDisplay) {
      return (
        <div
          key={`${event.timestamp}-${event.toolCallId ?? event.title}`}
          className="w-full pl-12 text-xs leading-6 text-slate-500"
        >
          <div className="flex w-fit max-w-[360px] items-start gap-2 rounded-md border border-slate-400/6 bg-slate-950/20 px-3 py-2">
            <span className="select-none text-slate-600">›</span>
            <div className="min-w-0 max-w-[300px]">
              <p className="m-0 whitespace-normal break-words text-slate-500">{readDisplay.message}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <article
        key={`${event.timestamp}-${event.toolCallId ?? event.title}`}
        className="max-w-[min(820px,100%)] rounded-[18px] border border-slate-400/10 bg-slate-900/55 px-[18px] py-4 text-slate-300"
      >
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>{event.title}</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <>
          <p className="m-0 text-slate-400">{event.statusLabel}</p>
          {event.details ? <p className="mt-2 m-0">{event.details}</p> : null}
          {renderJsonBlock('Raw input', event.rawInput)}
          {renderJsonBlock('Raw output', event.rawOutput)}
          {renderJsonBlock('Content', event.content)}
          {renderJsonBlock('Locations', event.locations)}
        </>
      </article>
    );
  }
  if (event.type === 'error') {
    return (
      <article
        key={`${event.timestamp}-error`}
        className="max-w-[min(820px,100%)] rounded-[18px] border border-rose-400/32 bg-[rgba(69,10,27,0.24)] px-[18px] py-4 text-slate-300"
      >
        <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
          <strong>Error</strong>
          <span>{formatTime(event.timestamp)}</span>
        </header>
        <p className="m-0 text-rose-300">{typeof event.message === 'string' ? event.message : 'Unknown error'}</p>
      </article>
    );
  }

  return null;
};

export default function ChatPanelContainer() {
  const {
    activeTask,
    displayItems,
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

  const timelineItems = displayItems
    .map((entry) => renderEvent(entry, handleApproval))
    .filter(Boolean);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <ChatHeader
        workspaceLabel={workspaceLabel}
        bootError={bootError}
        onChooseDirectory={() => void handleChooseDirectory()}
      />
      <section className="flex h-[calc(100vh-150px)] min-h-[560px] flex-col overflow-hidden rounded-[30px] border border-slate-400/20 bg-[linear-gradient(180deg,rgba(10,16,27,0.97),rgba(8,14,23,0.94))] px-0 py-0 shadow-[0_24px_72px_rgba(0,0,0,0.28)] backdrop-blur-[18px]">
        <div className="flex items-center justify-end border-b border-slate-400/10 bg-white/2 px-5 py-3 md:px-6">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${
              {
                idle: 'border-slate-400/16 bg-slate-400/12 text-slate-300',
                running: 'border-blue-500/28 bg-blue-500/14 text-blue-300',
                waiting: 'border-amber-500/28 bg-amber-500/16 text-orange-300',
              }[displayStatus.tone]
            }`}
          >
            {displayStatus.label}
          </span>
        </div>
        <ChatTimeline items={timelineItems} />
        <ChatComposer
          draft={draft}
          mode={activeTask?.mode ?? 'plan'}
          statusPhase={displayStatus.phase}
          statusLabel={displayStatus.label}
          onDraftChange={setDraft}
          onSend={() => void handleSend()}
          onStop={() => void handleAbort()}
        />
      </section>
    </div>
  );
}
