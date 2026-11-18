export const PASSWORD_MIN = 10;
export const PASSWORD_MAX_BYTES = 72;

export function passwordBytes(value) {
  return new TextEncoder().encode(value).length;
}

export function passwordError(value) {
  if (!value) return "Введите пароль.";
  if (value.length < PASSWORD_MIN) return "Пароль должен содержать не менее " + PASSWORD_MIN + " символов.";
  if (passwordBytes(value) > PASSWORD_MAX_BYTES) return "Пароль не должен превышать " + PASSWORD_MAX_BYTES + " байт.";
  return null;
}

export function passwordScore(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= PASSWORD_MIN) score += 1;
  if (value.length >= 14) score += 1;
  if (/[a-zа-я]/.test(value) && /[A-ZА-Я]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^\w\sа-яА-Я]/.test(value)) score += 1;
  return Math.min(4, Math.max(1, score));
}

export function passwordLabel(score) {
  return ["Слишком короткий", "Слабый", "Средний", "Надёжный", "Отличный"][score] || "Слабый";
}
