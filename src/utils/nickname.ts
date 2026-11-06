export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 32;

/** Обрезает пробелы по краям. */
export function normalizeNickname(value: string): string {
  return value.trim();
}

/** Текст ошибки или null, если ник подходит. Ник должен быть уже обрезан. */
export function validateNickname(nickname: string): string | null {
  if (nickname.length === 0) return 'Введите игровой ник.';
  if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) {
    return `Ник должен содержать от ${NICKNAME_MIN_LENGTH} до ${NICKNAME_MAX_LENGTH} символов.`;
  }
  return null;
}
