import { useSettingsStore } from '../store/useSettingsStore'
import { translations, type TranslationKey } from './translations'

export function useTranslation() {
  const language = useSettingsStore(s => s.settings.language)

  function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const dict = translations[language] ?? translations['de-DE']
    let text: string = dict[key] ?? translations['de-DE'][key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }

  return { t, language }
}
