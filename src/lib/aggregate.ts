import type { GithubCommit } from './github'

export type ContributorCount = {
  key: string
  label: string
  login: string | null
  commits: number
  avatarUrl?: string
}

/** Map git author names to logins seen on commits that have both (logins sorted A→Z). */
function buildNameToLogins(commits: GithubCommit[]): Map<string, string[]> {
  const sets = new Map<string, Set<string>>()

  for (const commit of commits) {
    const login = commit.author?.login
    const name = commit.commit.author?.name?.trim()
    if (!login || !name) continue

    let set = sets.get(name)
    if (!set) {
      set = new Set()
      sets.set(name, set)
    }
    set.add(login)
  }

  const map = new Map<string, string[]>()
  for (const [name, set] of sets) {
    map.set(name, [...set].sort((a, b) => a.localeCompare(b)))
  }
  return map
}

function contributorKey(
  commit: GithubCommit,
  nameToLogins: Map<string, string[]>,
): {
  key: string
  label: string
  login: string | null
} {
  const rawName = commit.commit.author?.name?.trim()
  const commitLogin = commit.author?.login ?? null
  const resolvedLogin =
    commitLogin ?? (rawName ? nameToLogins.get(rawName)?.[0] ?? null : null)

  if (rawName) {
    return {
      key: `name:${rawName}`,
      label: rawName,
      login: resolvedLogin,
    }
  }

  if (commitLogin) {
    return {
      key: `login:${commitLogin}`,
      label: commitLogin,
      login: commitLogin,
    }
  }

  const email = commit.commit.author?.email?.trim()
  const label = email ? `Unknown <${email}>` : 'Unknown'
  return {
    key: `name:Unknown|${email ?? ''}`,
    label,
    login: null,
  }
}

function authorNameFromCommit(commit: GithubCommit): string | null {
  const name = commit.commit.author?.name?.trim()
  return name || null
}

/** Normalize author name for case-insensitive matching. */
export function normalizeAuthorName(raw: string): string {
  return raw.trim().toLowerCase()
}

export function aggregateCommitsByAuthor(commits: GithubCommit[]): ContributorCount[] {
  const nameToLogins = buildNameToLogins(commits)
  const map = new Map<
    string,
    { label: string; login: string | null; commits: number; avatarUrl?: string }
  >()

  for (const commit of commits) {
    const { key, label, login } = contributorKey(commit, nameToLogins)
    const existing = map.get(key)
    if (existing) {
      existing.commits += 1
      if (!existing.login && login) existing.login = login
      if (!existing.avatarUrl && commit.author?.avatar_url) {
        existing.avatarUrl = commit.author.avatar_url
      }
    } else {
      map.set(key, {
        label,
        login,
        commits: 1,
        avatarUrl: commit.author?.avatar_url,
      })
    }
  }

  return [...map.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      login: value.login,
      commits: value.commits,
      avatarUrl: value.avatarUrl,
    }))
    .sort((a, b) => b.commits - a.commits || a.label.localeCompare(b.label))
}

/** Drop commits whose git author name is in the excluded set. */
export function filterCommitsByExcludedAuthorNames(
  commits: GithubCommit[],
  excludedNames: Iterable<string>,
): GithubCommit[] {
  const excluded = new Set(
    [...excludedNames].map(normalizeAuthorName).filter(Boolean),
  )
  if (excluded.size === 0) return commits

  return commits.filter((commit) => {
    const name = authorNameFromCommit(commit)
    if (!name) return true
    return !excluded.has(normalizeAuthorName(name))
  })
}

/** Distinct author names with commit counts (sorted by name). */
export function authorNameCommitCounts(
  commits: GithubCommit[],
): { name: string; commits: number }[] {
  const counts = new Map<string, number>()
  for (const commit of commits) {
    const name = authorNameFromCommit(commit)
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, commits]) => ({ name, commits }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
