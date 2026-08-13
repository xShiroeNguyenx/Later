import { useState } from 'react'
import { useT } from '../i18n'
import { Sheet } from '../screens/Sheet'
import { listThoughts, removeThought } from './storage'

/**
 * Daytime only — Home never routes here at night. No badges, no reminders, no
 * notifications: picking these back up has to be something you choose to do.
 */
export function ParkedList({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [items, setItems] = useState(listThoughts)

  return (
    <Sheet title={t.listTitle} onClose={onClose}>
      {items.length === 0 ? (
        <p className="empty">{t.listEmpty}</p>
      ) : (
        <ul className="thoughts">
          {items.map((th) => (
            <li className="thought" key={th.id}>
              <span>{th.text}</span>
              <time>{t.relativeDay(th.parkedAt)}</time>
              <button onClick={() => setItems(removeThought(th.id))} aria-label={t.ariaDone(th.text)}>
                ✓
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="quiet" onClick={onClose}>{t.close}</button>
    </Sheet>
  )
}
