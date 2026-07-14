/**
 * Normalize a GitHub blob or raw URL to a fetchable raw.githubusercontent.com URL.
 * Rejects non-CSV paths and unrecognized hosts.
 */
export function normalizeGithubCsvUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('CSV URL is empty.')
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('CSV URL is not a valid URL.')
  }

  const host = parsed.hostname.toLowerCase()

  if (host === 'raw.githubusercontent.com') {
    assertCsvPath(parsed.pathname)
    return parsed.toString()
  }

  if (host === 'github.com' || host === 'www.github.com') {
    // /owner/repo/blob/<ref>/path/to/file.csv
    const match = parsed.pathname.match(
      /^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/,
    )
    if (!match) {
      throw new Error(
        'GitHub CSV URL must be a blob or raw link to a .csv file.',
      )
    }
    const [, owner, repo, ref, filePath] = match
    assertCsvPath(`/${filePath}`)
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`
  }

  throw new Error(
    'CSV URL must be a github.com blob link or a raw.githubusercontent.com link.',
  )
}

function assertCsvPath(pathname: string): void {
  const path = pathname.split('?')[0]?.split('#')[0] ?? ''
  if (!path.toLowerCase().endsWith('.csv')) {
    throw new Error('URL must point to a .csv file.')
  }
}

/** Basename of a CSV URL path for report titles (e.g. "commits.csv"). */
export function csvUrlBasename(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const parts = pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    return last && last.toLowerCase().endsWith('.csv') ? last : 'file.csv'
  } catch {
    return 'file.csv'
  }
}
