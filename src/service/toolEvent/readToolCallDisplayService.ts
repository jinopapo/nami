import type { JsonValue } from '../../../core/chat';
import type { ReadToolCallDisplay } from '../../model/chat';

const getPathFromRawInput = (rawInput?: JsonValue): string | undefined => {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return undefined;
  }

  const path = rawInput.path;
  return typeof path === 'string' && path.length > 0 ? path : undefined;
};

const create = (rawInput?: JsonValue): ReadToolCallDisplay => {
  const path = getPathFromRawInput(rawInput);

  return {
    variant: 'read',
    path,
    message: path ? `${path} 読み込み中` : 'ファイル読み込み中',
  };
};

export const readToolCallDisplayService = {
  create,
};