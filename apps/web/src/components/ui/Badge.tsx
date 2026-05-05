import clsx from 'clsx'

type Variant = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'purple'

const styles: Record<Variant, string> = {
  green: 'bg-brand-50 text-brand-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
  purple: 'bg-purple-50 text-purple-700',
}

export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span className={clsx('inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium', styles[variant])}>
      {children}
    </span>
  )
}
