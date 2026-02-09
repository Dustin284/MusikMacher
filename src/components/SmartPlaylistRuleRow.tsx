import type { SmartTagRule, Tag } from '../types'
import { useTranslation } from '../i18n/useTranslation'

interface Props {
  rule: SmartTagRule
  tags: Tag[]
  onChange: (rule: SmartTagRule) => void
  onRemove: () => void
}

type FieldType = SmartTagRule['field']
type OperatorType = SmartTagRule['operator']

const FIELDS: { value: FieldType; labelKey: string }[] = [
  { value: 'bpm', labelKey: 'browse.bpm' },
  { value: 'musicalKey', labelKey: 'browse.key' },
  { value: 'rating', labelKey: 'browse.rating' },
  { value: 'name', labelKey: 'browse.name' },
  { value: 'comment', labelKey: 'browse.comment' },
  { value: 'duration', labelKey: 'browse.duration' },
  { value: 'tags', labelKey: 'browse.tags' },
  { value: 'playCount', labelKey: 'smartPlaylist.playCount' },
  { value: 'isFavorite', labelKey: 'browse.favorites' },
  { value: 'lastPlayedAt', labelKey: 'smartPlaylist.lastPlayed' },
  { value: 'energy', labelKey: 'browse.energy' },
  { value: 'mood', labelKey: 'browse.mood' },
]

const OPERATORS_BY_TYPE: Record<string, { value: OperatorType; labelKey: string }[]> = {
  number: [
    { value: 'equals', labelKey: 'smartPlaylist.opEquals' },
    { value: 'gt', labelKey: 'smartPlaylist.opGt' },
    { value: 'lt', labelKey: 'smartPlaylist.opLt' },
    { value: 'between', labelKey: 'smartPlaylist.opBetween' },
    { value: 'isEmpty', labelKey: 'smartPlaylist.opIsEmpty' },
    { value: 'isNotEmpty', labelKey: 'smartPlaylist.opIsNotEmpty' },
  ],
  string: [
    { value: 'equals', labelKey: 'smartPlaylist.opEquals' },
    { value: 'contains', labelKey: 'smartPlaylist.opContains' },
    { value: 'isEmpty', labelKey: 'smartPlaylist.opIsEmpty' },
    { value: 'isNotEmpty', labelKey: 'smartPlaylist.opIsNotEmpty' },
  ],
  tags: [
    { value: 'contains', labelKey: 'smartPlaylist.opContains' },
    { value: 'isEmpty', labelKey: 'smartPlaylist.opIsEmpty' },
    { value: 'isNotEmpty', labelKey: 'smartPlaylist.opIsNotEmpty' },
  ],
  boolean: [
    { value: 'equals', labelKey: 'smartPlaylist.opEquals' },
  ],
  date: [
    { value: 'daysAgo', labelKey: 'smartPlaylist.opDaysAgo' },
    { value: 'isEmpty', labelKey: 'smartPlaylist.opIsEmpty' },
    { value: 'isNotEmpty', labelKey: 'smartPlaylist.opIsNotEmpty' },
  ],
}

function getFieldType(field: FieldType): string {
  switch (field) {
    case 'bpm':
    case 'rating':
    case 'duration':
    case 'playCount':
    case 'energy':
      return 'number'
    case 'name':
    case 'comment':
    case 'musicalKey':
    case 'mood':
      return 'string'
    case 'tags':
      return 'tags'
    case 'isFavorite':
      return 'boolean'
    case 'lastPlayedAt':
      return 'date'
    default:
      return 'string'
  }
}

export default function SmartPlaylistRuleRow({ rule, tags, onChange, onRemove }: Props) {
  const { t } = useTranslation()
  const fieldType = getFieldType(rule.field)
  const operators = OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE.string

  const handleFieldChange = (newField: FieldType) => {
    const newFieldType = getFieldType(newField)
    const newOperators = OPERATORS_BY_TYPE[newFieldType] || OPERATORS_BY_TYPE.string
    // Reset operator if not valid for new field
    const validOperator = newOperators.find(op => op.value === rule.operator)
    onChange({
      ...rule,
      field: newField,
      operator: validOperator ? rule.operator : newOperators[0].value,
      value: '',
      value2: undefined,
    })
  }

  const needsValue = !['isEmpty', 'isNotEmpty'].includes(rule.operator)
  const needsSecondValue = rule.operator === 'between'

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-100/50 dark:bg-surface-800/50">
      {/* Field selector */}
      <select
        value={rule.field}
        onChange={(e) => handleFieldChange(e.target.value as FieldType)}
        className="flex-1 min-w-0 px-2 py-1.5 text-[13px] rounded-xl border-0 bg-surface-200/50 dark:bg-surface-800/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
      >
        {FIELDS.map(f => (
          <option key={f.value} value={f.value}>{t(f.labelKey as keyof typeof t)}</option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as OperatorType })}
        className="flex-1 min-w-0 px-2 py-1.5 text-[13px] rounded-xl border-0 bg-surface-200/50 dark:bg-surface-800/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
      >
        {operators.map(op => (
          <option key={op.value} value={op.value}>{t(op.labelKey as keyof typeof t)}</option>
        ))}
      </select>

      {/* Value input */}
      {needsValue && (
        <>
          {rule.field === 'tags' ? (
            <select
              value={rule.value}
              onChange={(e) => onChange({ ...rule, value: e.target.value })}
              className="flex-1 min-w-0 px-2 py-1.5 text-[13px] rounded-xl border-0 bg-surface-200/50 dark:bg-surface-800/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">{t('smartPlaylist.selectTag')}</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.name}>{tag.name}</option>
              ))}
            </select>
          ) : rule.field === 'isFavorite' ? (
            <select
              value={rule.value}
              onChange={(e) => onChange({ ...rule, value: e.target.value })}
              className="flex-1 min-w-0 px-2 py-1.5 text-[13px] rounded-xl border-0 bg-surface-200/50 dark:bg-surface-800/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="true">{t('context.favorite')}</option>
              <option value="false">{t('context.unfavorite')}</option>
            </select>
          ) : (
            <input
              type={fieldType === 'number' || fieldType === 'date' ? 'number' : 'text'}
              value={rule.value}
              onChange={(e) => onChange({ ...rule, value: e.target.value })}
              placeholder={rule.operator === 'daysAgo' ? t('smartPlaylist.daysPlaceholder') : t('smartTags.value')}
              className="flex-1 min-w-0 px-2 py-1.5 text-[13px] rounded-xl border-0 bg-surface-200/50 dark:bg-surface-800/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          )}

          {needsSecondValue && (
            <>
              <span className="text-xs text-surface-500">-</span>
              <input
                type="number"
                value={rule.value2 || ''}
                onChange={(e) => onChange({ ...rule, value2: e.target.value })}
                placeholder={t('smartTags.value')}
                className="w-20 px-2 py-1.5 text-[13px] rounded-xl border-0 bg-surface-200/50 dark:bg-surface-800/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              />
            </>
          )}
        </>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
