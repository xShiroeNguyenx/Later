const KEY = 'later.thoughts.v1'

export type Thought = { id: string; text: string; parkedAt: number }

function read(): Thought[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.filter(
      (t): t is Thought =>
        !!t && typeof t.id === 'string' && typeof t.text === 'string' && typeof t.parkedAt === 'number',
    )
  } catch {
    return []
  }
}

function write(list: Thought[]): Thought[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* nothing here is worth an error dialog at 2 AM */
  }
  return list
}

export const listThoughts = (): Thought[] => read().sort((a, b) => b.parkedAt - a.parkedAt)

export function addThought(text: string): Thought[] {
  const trimmed = text.trim()
  if (!trimmed) return listThoughts()
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  return write([...read(), { id, text: trimmed.slice(0, 280), parkedAt: Date.now() }])
}

export const removeThought = (id: string): Thought[] =>
  write(read().filter((t) => t.id !== id)).sort((a, b) => b.parkedAt - a.parkedAt)
