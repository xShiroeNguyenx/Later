import { useEffect, type ReactNode } from 'react'

type Props = { title: string; onClose: () => void; children: ReactNode }

/** The one overlay shape the app uses: a panel that rises from the bottom. */
export function Sheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

type OptsProps = {
  label: string
  value: string
  options: Array<{ v: string; label: string; disabled?: boolean }>
  onPick: (v: string) => void
}

export function Opts({ label, value, options, onPick }: OptsProps) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="opts" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.v}
            className="opt"
            role="radio"
            aria-checked={value === o.v}
            disabled={o.disabled}
            onClick={() => onPick(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
