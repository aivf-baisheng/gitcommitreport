const API_BASE = 'https://api.github.com'
const TOKEN_STORAGE_KEY = 'gitcommitreport_github_token'

export type RepoRef = {
  owner: string
  repo: string
}

export type GithubRepo = {
  full_name: string
  default_branch: string
  owner: {
    login: string
    type: 'User' | 'Organization' | string
  }
}

export type GithubBranch = {
  name: string
}

export type GithubCommit = {
  sha: string
  author: { login: string; avatar_url?: string } | null
  commit: {
    message?: string
    author: {
      name: string | null
      email: string | null
      date?: string | null
    } | null
  }
}

export class GithubApiError extends Error {
  status: number
  rateLimited: boolean

  constructor(message: string, status: number, rateLimited = false) {
    super(message)
    this.name = 'GithubApiError'
    this.status = status
    this.rateLimited = rateLimited
  }
}

export function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setStoredToken(token: string): void {
  try {
    if (token.trim()) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim())
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {
    // Ignore storage failures (private mode, etc.).
  }
}

/** Strip a leading `origin/` so local remote-tracking names work with the API. */
export function normalizeBranchName(branch: string): string {
  const trimmed = branch.trim()
  return trimmed.replace(/^origin\//, '')
}

/**
 * Accepts:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - github.com/owner/repo
 * - owner/repo
 */
export function parseGithubRepoUrl(input: string): RepoRef {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Enter a GitHub repository URL or owner/repo.')
  }

  const ownerRepo = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?(?:[?#].*)?$/i,
  )
  if (ownerRepo) {
    return { owner: ownerRepo[1], repo: ownerRepo[2] }
  }

  const short = trimmed.match(/^([^/]+)\/([^/]+?)(?:\.git)?\/?$/)
  if (short && !trimmed.includes('://')) {
    return { owner: short[1], repo: short[2] }
  }

  throw new Error(
    'Could not parse repository. Use https://github.com/owner/repo or owner/repo.',
  )
}

function authHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const effective = (token ?? getStoredToken()).trim()
  if (effective) {
    headers.Authorization = `Bearer ${effective}`
  }
  return headers
}

function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/)
    if (match) return match[1]
  }
  return null
}

async function githubFetch<T>(
  pathOrUrl: string,
  token?: string,
): Promise<{ data: T; link: string | null }> {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${API_BASE}${pathOrUrl}`

  const response = await fetch(url, { headers: authHeaders(token) })

  if (!response.ok) {
    const rateLimited = response.status === 403 || response.status === 429
    let detail = response.statusText
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) detail = body.message
    } catch {
      // ignore
    }

    if (rateLimited) {
      throw new GithubApiError(
        `GitHub API rate limit reached: ${detail}. Add a personal access token to continue.`,
        response.status,
        true,
      )
    }
    if (response.status === 404) {
      throw new GithubApiError(
        'Repository or branch not found. Check the URL, branch name, and token permissions.',
        404,
      )
    }
    throw new GithubApiError(`GitHub API error (${response.status}): ${detail}`, response.status)
  }

  const data = (await response.json()) as T
  return { data, link: response.headers.get('Link') }
}

export async function fetchRepo(
  owner: string,
  repo: string,
  token?: string,
): Promise<GithubRepo> {
  const { data } = await githubFetch<GithubRepo>(`/repos/${owner}/${repo}`, token)
  return data
}

export async function fetchBranches(
  owner: string,
  repo: string,
  token?: string,
  onProgress?: (count: number) => void,
): Promise<GithubBranch[]> {
  const branches: GithubBranch[] = []
  let url: string | null =
    `${API_BASE}/repos/${owner}/${repo}/branches?per_page=100`

  while (url) {
    const { data, link }: { data: GithubBranch[]; link: string | null } =
      await githubFetch<GithubBranch[]>(url, token)
    branches.push(...data)
    onProgress?.(branches.length)
    url = parseLinkNext(link)
  }

  return branches
}

export type CommitPageProgress = {
  pages: number
  commits: number
}

export async function fetchCommitsForBranch(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
  onProgress?: (progress: CommitPageProgress) => void,
): Promise<{ commits: GithubCommit[]; incomplete: boolean; warning?: string }> {
  const commits: GithubCommit[] = []
  const sha = normalizeBranchName(branch)
  let url: string | null =
    `${API_BASE}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(sha)}&per_page=100`
  let pages = 0
  let incomplete = false
  let warning: string | undefined

  while (url) {
    try {
      const { data, link }: { data: GithubCommit[]; link: string | null } =
        await githubFetch<GithubCommit[]>(url, token)
      pages += 1
      commits.push(...data)
      onProgress?.({ pages, commits: commits.length })
      url = parseLinkNext(link)
    } catch (err) {
      if (err instanceof GithubApiError && err.rateLimited && commits.length > 0) {
        incomplete = true
        warning = err.message
        break
      }
      throw err
    }
  }

  return { commits, incomplete, warning }
}

export type AllBranchesProgress = {
  branchIndex: number
  branchTotal: number
  branchName: string
  uniqueCommits: number
}

/**
 * Fetch commits from every branch and dedupe by SHA so shared history
 * is counted once.
 */
export async function fetchCommitsForAllBranches(
  owner: string,
  repo: string,
  branchNames: string[],
  token?: string,
  onProgress?: (progress: AllBranchesProgress) => void,
): Promise<{
  commits: GithubCommit[]
  incomplete: boolean
  warning?: string
  branchesScanned: number
}> {
  const bySha = new Map<string, GithubCommit>()
  let incomplete = false
  let warning: string | undefined
  let branchesScanned = 0

  for (let i = 0; i < branchNames.length; i += 1) {
    const branchName = branchNames[i]
    onProgress?.({
      branchIndex: i + 1,
      branchTotal: branchNames.length,
      branchName,
      uniqueCommits: bySha.size,
    })

    try {
      const result = await fetchCommitsForBranch(
        owner,
        repo,
        branchName,
        token,
        (p) => {
          onProgress?.({
            branchIndex: i + 1,
            branchTotal: branchNames.length,
            branchName,
            uniqueCommits: bySha.size + p.commits,
          })
        },
      )

      for (const commit of result.commits) {
        if (!bySha.has(commit.sha)) {
          bySha.set(commit.sha, commit)
        }
      }
      branchesScanned += 1

      if (result.incomplete) {
        incomplete = true
        warning =
          result.warning ??
          `Stopped while reading branch “${branchName}” due to rate limiting.`
        break
      }
    } catch (err) {
      if (err instanceof GithubApiError && err.rateLimited && bySha.size > 0) {
        incomplete = true
        warning = err.message
        break
      }
      throw err
    }
  }

  return {
    commits: [...bySha.values()],
    incomplete,
    warning,
    branchesScanned,
  }
}
