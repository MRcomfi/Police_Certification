import type { QuestionStatus } from '../grading/types';

/** Баллы с запятой: 11.5 → «11,5». */
export function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : String(points).replace('.', ',');
}

const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** «06.11.2026, 14:32:05» */
export function formatDateTime(timestamp: number): string {
  return dateTimeFormat.format(timestamp);
}

/** «14:32» */
export function formatTime(timestamp: number): string {
  return timeFormat.format(timestamp);
}

/** Оставшееся время в формате ММ:СС (секунды округляются вверх). */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Склонение: plural(2, ['пункт', 'пункта', 'пунктов']) → «пункта». */
export function plural(count: number, forms: readonly [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export const STATUS_LABELS: Readonly<Record<QuestionStatus, string>> = {
  correct: 'Верно',
  partial: 'Частично',
  incorrect: 'Неверно',
  empty: 'Нет ответа',
};
