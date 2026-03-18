import { useEffect, useMemo, useState } from 'react';
import type { ChatEvent } from '../core/chat';
import { chatRepository } from './repository/chatRepository';
import { useChatStore } from './store/chatStore';

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export default function App() {
  const {
    sessions,
    selectedSessionId,
    eventsBySession,
    draft,
    cwd,
    sending,
    setSessions,
    upsertSession,
    appendEvent,
    selectSession,
    setDraft,
    setCwd,
    setSending,
  } = useChatStore();
  const [title, setTitle] = useState('');
  const [bootError, setBootError] = useState<string | null>(null);
  const activeSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId),
    [selectedSessionId, sessions],
  );
  const activeEvents = selectedSessionId ? eventsBySession[selectedSessionId] ?? [] : [];

  useEffect(() => {
    if (!window.nami?.chat) {
      setBootError('Electron preload bridge is unavailable. Check preload loading in the main process.');
      return;
    }

    const unsubscribe = chatRepository.subscribeEvents((event: ChatEvent) => {
      if (event.type === 'session') {
        upsertSession(event.session);
      }

      if (event.sessionId) {
        appendEvent(event.sessionId, event as never);
      }
    });

    void chatRepository.listSessions()
      .then((nextSessions) => {
        setSessions(nextSessions as never);
        if (nextSessions[0]?.cwd) {
          setCwd(nextSessions[0].cwd);
        }
      })
      .catch((error: unknown) => {
        setBootError(error instanceof Error ? error.message : 'Failed to initialize renderer state.');
      });

    return unsubscribe;
  }, [appendEvent, setCwd, setSessions, upsertSession]);

  const handleCreateSession = async () => {
    try {
      const session = await chatRepository.createSession({ cwd: cwd || window.location.pathname, title });
      upsertSession(session as never);
      selectSession(session.sessionId);
      setTitle('');
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to create session.');
    }
  };

  const handleChooseDirectory = async () => {
    try {
      const result = await chatRepository.selectDirectory({ defaultPath: cwd || activeSession?.cwd });
      if (result.path) {
        setCwd(result.path);
      }
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to choose directory.');
    }
  };

  const handleSend = async () => {
    if (!selectedSessionId || !draft.trim()) {
      return;
    }

    setSending(true);

    try {
      await chatRepository.sendMessage({ sessionId: selectedSessionId, text: draft });
      setDraft('');
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleApproval = async (approvalId: string, decision: 'approve' | 'reject') => {
    if (!selectedSessionId) {
      return;
    }

    try {
      await chatRepository.respondToApproval({ sessionId: selectedSessionId, approvalId, decision });
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to respond to approval.');
    }
  };

  return (
    <main className="shell">
      <aside className="sidebar panel">
        <div className="panelHeader">
          <p className="eyebrow">Nami Agent</p>
          <h1>Agent Workspace</h1>
        </div>
        <label className="field">
          <span>Workspace</span>
          <div className="fieldRow">
            <input value={cwd} onChange={(event) => setCwd(event.target.value)} placeholder="/absolute/path" />
            <button className="secondaryButton" type="button" onClick={() => void handleChooseDirectory()}>
              Choose Directory
            </button>
          </div>
        </label>
        <label className="field">
          <span>Session Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Feature work" />
        </label>
        <button className="primaryButton" onClick={() => void handleCreateSession()}>
          New Session
        </button>
        {bootError ? <p className="errorText">{bootError}</p> : null}
        <div className="sessionList">
          {sessions.map((session) => (
            <button
              key={session.sessionId}
              className={`sessionItem ${session.sessionId === selectedSessionId ? 'active' : ''}`}
              onClick={() => selectSession(session.sessionId)}
            >
              <strong>{session.title}</strong>
              <span>{session.live ? 'live' : 'archived'}</span>
              <small>{session.cwd}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Conversation</p>
            <h2>{activeSession?.title ?? 'No Session Selected'}</h2>
          </div>
          <button
            className="secondaryButton"
            disabled={!selectedSessionId}
            onClick={() => selectedSessionId && void chatRepository.abortTask({ sessionId: selectedSessionId })}
          >
            Stop
          </button>
        </div>
        <div className="timeline">
          {activeEvents.map((event) => (
            <article key={event.id} className={`eventCard event-${event.type}`}>
              <header>
                <strong>{event.type}</strong>
                <span>{formatTime(event.timestamp)}</span>
              </header>
              {'text' in event ? <p>{String(event.text)}</p> : null}
              {'status' in event ? <p>{String(event.status)} {event.detail ? `· ${String(event.detail)}` : ''}</p> : null}
              {'entries' in event ? (
                <ul>{event.entries.map((entry) => <li key={`${event.id}-${entry.content}`}>{entry.status}: {entry.content}</li>)}</ul>
              ) : null}
              {'title' in event ? <p>{String(event.title)}</p> : null}
              {'diff' in event ? (
                <ul>{event.diff.items.map((item) => <li key={`${event.id}-${item.path}`}>{item.path} · {item.summary}</li>)}</ul>
              ) : null}
              {'approval' in event ? (
                <div className="approvalActions">
                  <p>{event.approval.title}</p>
                  <button onClick={() => void handleApproval(event.approval.approvalId, 'approve')}>Approve</button>
                  <button onClick={() => void handleApproval(event.approval.approvalId, 'reject')}>Reject</button>
                </div>
              ) : null}
              {'message' in event ? <p className="errorText">{String(event.message)}</p> : null}
            </article>
          ))}
        </div>
        <div className="composer">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Describe the change you want the agent to make..."
            disabled={!selectedSessionId || !activeSession?.live}
          />
          <button className="primaryButton" disabled={!selectedSessionId || sending || !activeSession?.live} onClick={() => void handleSend()}>
            {sending ? 'Working…' : 'Send'}
          </button>
        </div>
      </section>

      <aside className="inspector panel">
        <div className="panelHeader">
          <p className="eyebrow">Inspector</p>
          <h2>Session Details</h2>
        </div>
        <dl className="details">
          <div><dt>Platform</dt><dd>{window.nami?.platform ?? 'unknown'}</dd></div>
          <div><dt>Mode</dt><dd>{activeSession?.mode ?? 'n/a'}</dd></div>
          <div><dt>State</dt><dd>{activeSession?.live ? 'Live' : 'Archived'}</dd></div>
          <div><dt>Path</dt><dd>{activeSession?.cwd ?? 'n/a'}</dd></div>
        </dl>
      </aside>
    </main>
  );
}
