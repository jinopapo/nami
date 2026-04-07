import { taskRepository } from '../repository/taskRepository';
import type { SessionEvent } from '../model/chat';

type TaskEvent = Parameters<
  Parameters<typeof taskRepository.subscribeEvents>[0]
>[0];

export const autoCheckEventService = {
  toSessionEvent(event: TaskEvent): SessionEvent | undefined {
    if (event.type === 'autoCheckStarted') {
      return {
        type: 'autoCheckStarted',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: event.taskId,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        run: event.run,
      };
    }

    if (event.type === 'autoCheckStep') {
      return {
        type: 'autoCheckStep',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: event.taskId,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        step: event.step,
      };
    }

    if (event.type === 'autoCheckCompleted') {
      return {
        type: 'autoCheckCompleted',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: event.taskId,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        autoCheckRunId: event.autoCheckRunId,
        result: event.result,
      };
    }

    if (event.type === 'autoCheckFeedbackPrepared') {
      return {
        type: 'autoCheckFeedback',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: event.taskId,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        feedback: event.feedback,
      };
    }

    return undefined;
  },
};
