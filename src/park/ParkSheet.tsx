import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Sheet } from '../screens/Sheet'
import { addThought } from './storage'

/**
 * Overthinking usually has a specific shape: *if I don't think about this now,
 * I'll forget it by morning.* So the brain keeps rehearsing it. Writing it down
 * somewhere it will definitely still be tomorrow removes the reason to rehearse.
 *
 * Nothing leaves the device and nothing is ever pushed back at you — the promise
 * only holds if it is kept completely.
 */
export function ParkSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])

  useEffect(() => {
    if (!saved) return
    const id = setTimeout(onClose, 2800)
    return () => clearTimeout(id)
  }, [saved, onClose])

  const park = () => {
    if (!text.trim()) return
    addThought(text)
    setSaved(true)
  }

  if (saved) {
    return (
      <Sheet title={t.parkedTitle} onClose={onClose}>
        <p className="said">
          {t.savedLine1}
          <br />
          {t.savedLine2}
        </p>
      </Sheet>
    )
  }

  return (
    <Sheet title={t.parkTitle} onClose={onClose}>
      <input
        ref={input}
        className="input"
        value={text}
        placeholder={t.parkPlaceholder}
        enterKeyHint="done"
        autoComplete="off"
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') park()
        }}
      />
      <button className="primary" onClick={park} disabled={!text.trim()}>
        {t.parkAction}
      </button>
      <button className="quiet" onClick={onClose}>{t.parkCancel}</button>
    </Sheet>
  )
}
