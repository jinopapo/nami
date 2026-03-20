import type { SessionUpdate } from 'cline';
import type { TaskEvent, TaskState } from '../../core/chat';

export type UiTask = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  state: TaskState;
};

export type UiEvent = TaskEvent;

export type SessionUpdateEvent = Extract<TaskEvent, { type: 'sessionUpdate' }>;

export const extractMessageText = (update: SessionUpdate): string | undefined => {
  if ('text' in update && typeof update.text === 'string') {
    return update.text;
  }

  if ('content' in update && update.content && typeof update.content === 'object' && 'type' in update.content && update.content.type === 'text' && 'text' in update.content && typeof update.content.text === 'string') {
    return update.content.text;
  }

  return undefined;
};
