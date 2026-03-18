import { create } from 'zustand';
import type { UiEvent, UiSession } from '../model/chat';

type ChatState = {
  sessions: UiSession[];
  selectedSessionId?: string;
  eventsBySession: Record<string, UiEvent[]>;
  draft: string;
  cwd: string;
  sending: boolean;
  setSessions: (sessions: UiSession[]) => void;
  upsertSession: (session: UiSession) => void;
  appendEvent: (sessionId: string, event: UiEvent) => void;
  selectSession: (sessionId: string) => void;
  setDraft: (draft: string) => void;
  setCwd: (cwd: string) => void;
  setSending: (sending: boolean) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  selectedSessionId: undefined,
  eventsBySession: {},
  draft: '',
  cwd: '',
  sending: false,
  setSessions: (sessions) =>
    set((state) => ({
      sessions,
      selectedSessionId: state.selectedSessionId ?? sessions[0]?.sessionId,
      cwd: state.cwd || sessions[0]?.cwd || '',
    })),
  upsertSession: (session) =>
    set((state) => {
      const sessions = state.sessions.filter((item) => item.sessionId !== session.sessionId);
      sessions.unshift(session);
      return {
        sessions,
        selectedSessionId: state.selectedSessionId ?? session.sessionId,
        cwd: state.cwd || session.cwd,
      };
    }),
  appendEvent: (sessionId, event) =>
    set((state) => ({
      eventsBySession: {
        ...state.eventsBySession,
        [sessionId]: [...(state.eventsBySession[sessionId] ?? []), event],
      },
    })),
  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
  setDraft: (draft) => set({ draft }),
  setCwd: (cwd) => set({ cwd }),
  setSending: (sending) => set({ sending }),
}));
