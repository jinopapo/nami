import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { DisplayItem } from '../model/chat';

type ChatEventTimelineProps = {
  displayItems: DisplayItem[];
  shouldAutoScroll: boolean;
  autoScrollKey: string;
  onApproval: (
    approvalId: string,
    decision: 'approve' | 'reject',
  ) => Promise<void>;
};

type ApprovalHandler = ChatEventTimelineProps['onApproval'];
type CardArgs = {
  key: string;
  title: string;
  timestamp: string;
  className: string;
  children: ReactNode;
};

const cardClassName = 'max-w-[min(820px,100%)] rounded-[18px] px-[18px] py-4';

export default function ChatEventTimeline({
  displayItems,
  shouldAutoScroll,
  autoScrollKey,
  onApproval,
}: ChatEventTimelineProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!shouldAutoScroll) {
      return;
    }

    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [autoScrollKey, shouldAutoScroll]);

  const items = useMemo(
    () => displayItems.map((event) => renderEvent(event, onApproval)),
    [displayItems, onApproval],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-5 md:px-6">
      {items}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const renderCard = ({
  key,
  title,
  timestamp,
  className,
  children,
}: CardArgs) => (
  <article key={key} className={`${cardClassName} ${className}`}>
    <header className="mb-2 flex flex-col justify-between gap-3 text-slate-400 md:flex-row">
      <strong>{title}</strong>
      <span>{formatTime(timestamp)}</span>
    </header>
    {children}
  </article>
);

const renderJsonBlock = (label: string, value: unknown) =>
  value === undefined ? null : (
    <section className="mt-3">
      <p className="m-0 mb-1 text-xs uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <pre className="m-0 overflow-x-auto rounded-xl bg-black/20 p-3 text-xs text-slate-300 whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );

const renderMessage = (
  event: Extract<DisplayItem, { type: 'userMessage' | 'assistantMessage' }>,
) => {
  const isUser = event.role === 'user';
  const authorInitial = isUser ? 'Y' : 'N';
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
    <div
      key={event.id}
      className={`flex w-full items-start gap-3 ${isUser ? 'justify-end' : ''}`}
    >
      {!isUser ? <div className={avatarClassName}>{authorInitial}</div> : null}
      <article className={bubbleClassName}>
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
          <span>{formatTime(event.timestamp)}</span>
          {event.status !== 'sent' ? (
            <span className="rounded-full bg-slate-400/15 px-2 py-0.5 text-[0.72rem] uppercase tracking-[0.08em] text-slate-300">
              {event.status === 'streaming' ? 'streaming' : 'sending'}
            </span>
          ) : null}
        </div>
        <p className="m-0 whitespace-pre-wrap break-words text-[0.98rem] text-slate-100">
          {event.text}
        </p>
      </article>
      {isUser ? <div className={avatarClassName}>{authorInitial}</div> : null}
    </div>
  );
};

const renderToolCall = (event: Extract<DisplayItem, { type: 'toolCall' }>) =>
  event.display.variant === 'read' ? (
    <div
      key={`${event.timestamp}-${event.toolCallId ?? event.title}`}
      className="w-full pl-12 text-xs leading-6 text-slate-500"
    >
      <div className="flex w-fit max-w-[360px] items-start gap-2 rounded-md border border-slate-400/6 bg-slate-950/20 px-3 py-2">
        <span className="select-none text-slate-600">›</span>
        <div className="min-w-0 max-w-[300px]">
          <p className="m-0 whitespace-normal break-words text-slate-500">
            {event.display.message}
          </p>
        </div>
      </div>
    </div>
  ) : (
    renderCard({
      key: `${event.timestamp}-${event.toolCallId ?? event.title}`,
      title: event.title,
      timestamp: event.timestamp,
      className: 'border border-slate-400/10 bg-slate-900/55 text-slate-300',
      children: (
        <>
          <p className="m-0 text-slate-400">{event.statusLabel}</p>
          {event.details ? <p className="mt-2 m-0">{event.details}</p> : null}
          {renderJsonBlock('Raw input', event.rawInput)}
          {renderJsonBlock('Raw output', event.rawOutput)}
          {renderJsonBlock('Content', event.content)}
          {renderJsonBlock('Locations', event.locations)}
        </>
      ),
    })
  );

const renderApprovalRequest = (
  event: Extract<DisplayItem, { type: 'permissionRequest' }>,
  onApproval: ApprovalHandler,
) =>
  renderCard({
    key: `${event.timestamp}-${event.approvalId}`,
    title: 'Approval required',
    timestamp: event.timestamp,
    className:
      'border border-pink-400/32 bg-[rgba(71,20,48,0.24)] text-slate-300',
    children: (
      <>
        <p className="m-0">{event.title}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['approve', 'reject'] as const).map((decision) => (
            <button
              key={decision}
              type="button"
              className="rounded-full bg-slate-400/14 px-3.5 py-2.5 text-inherit transition duration-150 ease-out hover:-translate-y-px"
              onClick={() => void onApproval(event.approvalId, decision)}
            >
              {decision === 'approve' ? 'Approve' : 'Reject'}
            </button>
          ))}
        </div>
      </>
    ),
  });

const renderHumanDecisionRequest = (
  event: Extract<DisplayItem, { type: 'humanDecisionRequest' }>,
) =>
  renderCard({
    key: `${event.timestamp}-${event.requestId}`,
    title: 'Human decision required',
    timestamp: event.timestamp,
    className:
      'border border-pink-400/32 bg-[rgba(71,20,48,0.24)] text-slate-300',
    children: (
      <>
        <p className="m-0">{event.title}</p>
        {event.description ? (
          <p className="mt-2 m-0 text-slate-400">{event.description}</p>
        ) : null}
      </>
    ),
  });

const renderTaskStateChanged = (
  event: Extract<DisplayItem, { type: 'taskStateChanged' }>,
) =>
  renderCard({
    key: `${event.timestamp}-${event.state}`,
    title: event.state,
    timestamp: event.timestamp,
    className: 'border border-slate-400/10 bg-slate-900/55 text-slate-300',
    children:
      typeof event.reason === 'string' && event.reason ? (
        <p className="m-0 text-slate-400">{event.reason}</p>
      ) : null,
  });

const renderAutoCheckRun = (
  event: Extract<DisplayItem, { type: 'autoCheckRun' }>,
) =>
  renderCard({
    key: event.id,
    title: event.title,
    timestamp: event.timestamp,
    className: 'border border-cyan-400/20 bg-cyan-950/20 text-slate-200',
    children: (
      <p className="m-0 text-slate-400">
        {event.status === 'started'
          ? `実行予定ステップ数: ${event.stepCount ?? 0}`
          : event.success
            ? 'すべてのチェックが成功しました'
            : '失敗したステップがあります'}
      </p>
    ),
  });

const renderAutoCheckStep = (
  event: Extract<DisplayItem, { type: 'autoCheckStep' }>,
) =>
  renderCard({
    key: event.id,
    title: event.name,
    timestamp: event.timestamp,
    className: 'border border-cyan-400/12 bg-slate-900/55 text-slate-300',
    children: (
      <>
        <p className="m-0 text-slate-400">{event.command}</p>
        <p className="mt-2 m-0">
          {event.phase === 'started'
            ? '実行中'
            : event.success
              ? '成功'
              : `失敗 (exitCode: ${event.exitCode ?? 'unknown'})`}
        </p>
        {event.phase === 'finished' && !event.success && event.output ? (
          <pre className="mt-3 m-0 overflow-x-auto rounded-xl bg-black/20 p-3 text-xs text-rose-200 whitespace-pre-wrap break-words">
            {event.output}
          </pre>
        ) : null}
      </>
    ),
  });

const renderAutoCheckFeedback = (
  event: Extract<DisplayItem, { type: 'autoCheckFeedback' }>,
) =>
  renderCard({
    key: event.id,
    title: '自動チェック失敗を agent にフィードバック',
    timestamp: event.timestamp,
    className: 'border border-amber-400/20 bg-amber-950/20 text-slate-200',
    children: (
      <>
        <p className="m-0 text-slate-400">
          {event.name} / exitCode: {event.exitCode}
        </p>
        <pre className="mt-3 m-0 overflow-x-auto rounded-xl bg-black/20 p-3 text-xs text-slate-300 whitespace-pre-wrap break-words">
          {event.prompt}
        </pre>
      </>
    ),
  });

const renderError = (event: Extract<DisplayItem, { type: 'error' }>) =>
  renderCard({
    key: `${event.timestamp}-error`,
    title: 'Error',
    timestamp: event.timestamp,
    className:
      'border border-rose-400/32 bg-[rgba(69,10,27,0.24)] text-slate-300',
    children: (
      <p className="m-0 text-rose-300">{event.message || 'Unknown error'}</p>
    ),
  });

const renderEvent = (event: DisplayItem, onApproval: ApprovalHandler) => {
  if (event.type === 'userMessage' || event.type === 'assistantMessage')
    return renderMessage(event);
  if (event.type === 'permissionRequest')
    return renderApprovalRequest(event, onApproval);
  if (event.type === 'taskStateChanged')
    return event.state === 'running' || event.state === 'completed'
      ? null
      : renderTaskStateChanged(event);
  if (event.type === 'plan') return null;
  if (event.type === 'humanDecisionRequest')
    return renderHumanDecisionRequest(event);
  if (event.type === 'toolCall') return renderToolCall(event);
  if (event.type === 'autoCheckRun') return renderAutoCheckRun(event);
  if (event.type === 'autoCheckStep') return renderAutoCheckStep(event);
  if (event.type === 'autoCheckFeedback') return renderAutoCheckFeedback(event);
  return event.type === 'error' ? renderError(event) : null;
};
