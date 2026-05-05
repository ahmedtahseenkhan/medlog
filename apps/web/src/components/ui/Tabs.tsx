interface Tab { key: string; label: string; icon?: React.ElementType }

export function Tabs<T extends string>({ tabs, active, onChange }: {
  tabs: Tab[]
  active: T
  onChange: (key: T) => void
}) {
  return (
    <div className="flex gap-1">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key as T)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            active === key ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </button>
      ))}
    </div>
  )
}
