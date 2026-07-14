import type { GithubCommit } from './github'

const CSV_HEADERS = [
  'sha',
  'login',
  'author_name',
  'author_email',
  'author_date',
  'message',
] as const

export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function firstLine(message: string | undefined): string {
  if (!message) return ''
  const line = message.split(/\r?\n/, 1)[0] ?? ''
  return line.trim()
}

/** Parse CSV text into rows, supporting quoted fields with commas/newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const input = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]
    const next = input[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch === '\r') {
      // Ignore CR; LF handles line ends (CRLF).
    } else {
      cell += ch
    }
  }

  if (inQuotes) {
    throw new Error('CSV has an unclosed quoted field.')
  }

  // Trailing content without a final newline still counts as a row.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  // Drop a trailing empty line produced by a final newline.
  if (rows.length > 0) {
    const last = rows[rows.length - 1]
    if (last.length === 1 && last[0] === '') {
      rows.pop()
    }
  }

  return rows
}

export function commitsToCsv(commits: GithubCommit[]): string {
  const rows = commits.map((c) =>
    [
      c.sha,
      c.author?.login ?? '',
      c.commit.author?.name ?? '',
      c.commit.author?.email ?? '',
      c.commit.author?.date ?? '',
      firstLine(c.commit.message),
    ]
      .map(escapeCsvCell)
      .join(','),
  )

  return [CSV_HEADERS.join(','), ...rows].join('\n')
}

/**
 * Parse a CSV previously exported by commitsToCsv into GithubCommit objects.
 * Requires a header row with the expected column names (order-flexible).
 */
export function commitsFromCsv(text: string): GithubCommit[] {
  const rows = parseCsv(text)
  if (rows.length === 0) {
    throw new Error('CSV is empty.')
  }

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const index = Object.fromEntries(
    CSV_HEADERS.map((name) => [name, header.indexOf(name)]),
  ) as Record<(typeof CSV_HEADERS)[number], number>

  if (index.sha < 0) {
    throw new Error(
      'CSV is missing a required “sha” column. Use a file exported by Download CSV.',
    )
  }

  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''))
  if (dataRows.length === 0) {
    throw new Error('CSV has no commit rows.')
  }

  return dataRows.map((r, i) => {
    const sha = (r[index.sha] ?? '').trim()
    if (!sha) {
      throw new Error(`CSV row ${i + 2} is missing a sha.`)
    }

    const login = index.login >= 0 ? (r[index.login] ?? '').trim() : ''
    const authorName =
      index.author_name >= 0 ? (r[index.author_name] ?? '').trim() : ''
    const authorEmail =
      index.author_email >= 0 ? (r[index.author_email] ?? '').trim() : ''
    const authorDate =
      index.author_date >= 0 ? (r[index.author_date] ?? '').trim() : ''
    const message = index.message >= 0 ? (r[index.message] ?? '') : ''

    return {
      sha,
      author: login ? { login } : null,
      commit: {
        message,
        author: {
          name: authorName || null,
          email: authorEmail || null,
          date: authorDate || null,
        },
      },
    }
  })
}

export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Sanitize repo/branch fragments for a safe download filename. */
export function sanitizeFilenamePart(raw: string): string {
  return raw
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'scan'
}
