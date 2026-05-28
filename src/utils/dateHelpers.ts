export function getISTDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Today + `offset` days as YYYY-MM-DD. offset 0 = today (matches getISTDate),
// offset 1 = tomorrow. Used to key per-date meal swaps so today's and
// tomorrow's overrides land under the right date.
export function getDateForOffset(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
