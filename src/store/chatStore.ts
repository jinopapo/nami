import { create } from 'zustand';
import type { UiEvent, UiSession } from '../model/chat';

const resolveSelectedSessionId = (sessions: UiSession[], selectedSessionId?: string) => {
  if (selectedSessionId && sessions.some((session) => session.sessionId === selectedSessionId)) {
    return selectedSessionId;
  }

  return sessions[0]?.sessionId;
};

const mergeMessageEvent = (events: UiEvent[], event: UiEvent): UiEvent[] => {
  if (event.type !== 'message') {
    return [...events, event];
  }

  const previous = events.at(-1);

  if (
    previous?.type === 'message'
    && previous.sessionId === event.sessionId
    && previous.role === event.role
    && typeof previous.text === 'string'
    && typeof event.text === 'string'
    && (!previous.messageId || !event.messageId || previous.messageId === event.messageId)
  ) {
    return [
      ...events.slice(0, -1),
      {
        ...previous,
        text: `${previous.text}${event.text}`,
        timestamp: event.timestamp,
      },
    ];
  }

  return [...events, event];
};

type ChatState = {
  sessions: UiSession[];
  selectedSessionId?: string;
  eventsBySession: Record<string, UiEvent[]>;
  draft: string;
  cwd: string;
  sending: boolean;
  bootError: string | null;
  setSessions: (sessions: UiSession[]) => void;
  upsertSession: (session: UiSession) => void;
  appendEvent: (sessionId: string, event: UiEvent) => void;
  selectSession: (sessionId: string) => void;
  setDraft: (draft: string) => void;
  setCwd: (cwd: string) => void;
  setSending: (sending: boolean) => void;
  setBootError: (bootError: string | null) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  selectedSessionId: undefined,
  eventsBySession: {},
  draft: '',
  cwd: '',
  sending: false,
  bootError: null,
  setSessions: (sessions) =>
    set((state) => ({
      sessions,
      selectedSessionId: resolveSelectedSessionId(sessions, state.selectedSessionId),
      cwd: state.cwd || sessions[0]?.cwd || '',
    })),
  upsertSession: (session) =>
    set((state) => {
      const sessions = state.sessions.filter((item) => item.sessionId !== session.sessionId);
      sessions.unshift(session);
      return {
        sessions,
        selectedSessionId: state.selectedSessionId === session.sessionId
          ? session.sessionId
          : state.selectedSessionId ?? session.sessionId,
        cwd: state.cwd || session.cwd,
      };
    }),
  appendEvent: (sessionId, event) =>
    set((state) => ({
      eventsBySession: {
        ...state.eventsBySession,
        [sessionId]: mergeMessageEvent(state.eventsBySession[sessionId] ?? [], event),
      },
    })),
  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
  setDraft: (draft) => set({ draft }),
  setCwd: (cwd) => set({ cwd }),
  setSending: (sending) => set({ sending }),
  setBootError: (bootError) => set({ bootError }),
}));

export { mergeMessageEvent, resolveSelectedSessionId };
