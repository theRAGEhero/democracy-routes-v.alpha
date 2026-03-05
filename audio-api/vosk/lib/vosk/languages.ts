export const VOSK_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italian' }
];

export const DEFAULT_VOSK_LANGUAGE = 'en';

export function isVoskLanguage(value: string) {
  return VOSK_LANGUAGE_OPTIONS.some(option => option.value === value);
}
