import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircleIcon, DownloadIcon, InfoIcon } from 'lucide-react'
import {
  aggregateCommitsByAuthor,
  authorNameCommitCounts,
  filterCommitsByExcludedAuthorNames,
  normalizeAuthorName,
  type ContributorCount,
} from '@/lib/aggregate'
import {
  commitsFromCsv,
  commitsToCsv,
  downloadCsv,
  sanitizeFilenamePart,
} from '@/lib/csv'
import {
  csvUrlBasename,
  normalizeGithubCsvUrl,
} from '@/lib/githubCsvUrl'
import {
  fetchBranches,
  fetchCommitsForAllBranches,
  fetchCommitsForBranch,
  fetchRepo,
  getStoredToken,
  GithubApiError,
  normalizeBranchName,
  parseGithubRepoUrl,
  type GithubCommit,
  type GithubRepo,
} from '@/lib/github'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CommitChart } from '@/components/CommitChart'
import { ContributorExcludeList } from '@/components/ContributorExcludeList'
import { RepoForm } from '@/components/RepoForm'

export default function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [defaultBranch, setDefaultBranch] = useState<string | undefined>()
  const [allBranches, setAllBranches] = useState(false)
  const [repoMeta, setRepoMeta] = useState<GithubRepo | null>(null)
  const [token, setToken] = useState(() => getStoredToken())

  const [loadingBranches, setLoadingBranches] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loadingCsvUrl, setLoadingCsvUrl] = useState(false)
  const [csvUrl, setCsvUrl] = useState('')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const csvQueryLoaded = useRef(false)

  const [contributors, setContributors] = useState<ContributorCount[]>([])
  const [scannedCommits, setScannedCommits] = useState<GithubCommit[]>([])
  const [reportTitle, setReportTitle] = useState<string | null>(null)
  const [excludedNames, setExcludedNames] = useState<string[]>([])

  const authorNames = useMemo(
    () => authorNameCommitCounts(scannedCommits),
    [scannedCommits],
  )

  const visibleContributors = useMemo(() => {
    const visibleCommits = filterCommitsByExcludedAuthorNames(
      scannedCommits,
      excludedNames,
    )
    if (excludedNames.length === 0) return contributors
    return aggregateCommitsByAuthor(visibleCommits)
  }, [scannedCommits, excludedNames, contributors])

  const loadBranches = useCallback(async () => {
    setError(null)
    setWarning(null)
    setLoadingBranches(true)
    setProgress('Fetching repository…')

    try {
      const { owner, repo } = parseGithubRepoUrl(repoUrl)
      const meta = await fetchRepo(owner, repo, token)
      setRepoMeta(meta)
      setDefaultBranch(meta.default_branch)
      setProgress('Loading branches…')

      const list = await fetchBranches(owner, repo, token, (count) => {
        setProgress(`Loading branches… (${count})`)
      })
      const names = list.map((b) => b.name).sort((a, b) => a.localeCompare(b))
      setBranches(names)

      const preferred = branch
        ? normalizeBranchName(branch)
        : meta.default_branch
      const nextBranch = names.includes(preferred)
        ? preferred
        : names.includes(meta.default_branch)
          ? meta.default_branch
          : names[0] ?? preferred
      setBranch(nextBranch)
      setProgress('')
    } catch (err) {
      setBranches([])
      setRepoMeta(null)
      setProgress('')
      setError(err instanceof Error ? err.message : 'Failed to load branches.')
    } finally {
      setLoadingBranches(false)
    }
  }, [repoUrl, token, branch])

  const generateReport = useCallback(async () => {
    setError(null)
    setWarning(null)
    setGenerating(true)
    setContributors([])
    setScannedCommits([])
    setReportTitle(null)
    setExcludedNames([])

    try {
      const { owner, repo } = parseGithubRepoUrl(repoUrl)

      setProgress('Fetching repository…')
      const meta =
        repoMeta?.full_name === `${owner}/${repo}`
          ? repoMeta
          : await fetchRepo(owner, repo, token)
      setRepoMeta(meta)
      setDefaultBranch(meta.default_branch)

      let branchNames = branches
      if (allBranches || branchNames.length === 0) {
        setProgress('Loading branches…')
        const list = await fetchBranches(owner, repo, token, (count) => {
          setProgress(`Loading branches… (${count})`)
        })
        branchNames = list.map((b) => b.name).sort((a, b) => a.localeCompare(b))
        setBranches(branchNames)
      }

      if (allBranches) {
        if (branchNames.length === 0) {
          setError('No branches found in this repository.')
          setProgress('')
          return
        }

        setProgress(`Fetching commits across ${branchNames.length} branches…`)
        const { commits, incomplete, warning: commitWarning, branchesScanned } =
          await fetchCommitsForAllBranches(
            owner,
            repo,
            branchNames,
            token,
            (p) => {
              setProgress(
                `Branch ${p.branchIndex}/${p.branchTotal}: ${p.branchName} (${p.uniqueCommits} unique commits)`,
              )
            },
          )

        if (commits.length === 0) {
          setError('No commits found across repository branches.')
          setProgress('')
          return
        }

        const byAuthor = aggregateCommitsByAuthor(commits)
        setScannedCommits(commits)
        setContributors(byAuthor)
        setReportTitle(
          `${meta.full_name} @ all branches (${branchesScanned}/${branchNames.length})`,
        )
        setProgress('')

        if (incomplete && commitWarning) {
          setWarning(
            `Partial results: stopped early due to rate limiting. ${commitWarning}`,
          )
        }
        return
      }

      const sha = normalizeBranchName(branch) || 'HEAD'
      setProgress('Fetching commits…')
      const { commits, incomplete, warning: commitWarning } =
        await fetchCommitsForBranch(owner, repo, sha, token, (p) => {
          setProgress(`Fetching commits… page ${p.pages} (${p.commits} commits)`)
        })

      if (commits.length === 0) {
        setError(`No commits found on branch “${sha}”.`)
        setProgress('')
        return
      }

      const byAuthor = aggregateCommitsByAuthor(commits)
      setScannedCommits(commits)
      setContributors(byAuthor)
      setReportTitle(`${meta.full_name} @ ${sha}`)
      setProgress('')

      if (incomplete && commitWarning) {
        setWarning(
          `Partial results: stopped early due to rate limiting. ${commitWarning}`,
        )
      }
    } catch (err) {
      setProgress('')
      if (err instanceof GithubApiError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate report.')
      }
    } finally {
      setGenerating(false)
    }
  }, [repoUrl, branch, allBranches, token, repoMeta, branches])

  function toggleExcluded(name: string, excluded: boolean) {
    const target = normalizeAuthorName(name)
    setExcludedNames((prev) => {
      const has = prev.some((n) => normalizeAuthorName(n) === target)
      if (excluded && !has) return [...prev, name.trim()]
      if (!excluded && has) {
        return prev.filter((n) => normalizeAuthorName(n) !== target)
      }
      return prev
    })
  }

  const totalCommits = visibleContributors.reduce((sum, c) => sum + c.commits, 0)
  const excludedCommitCount = scannedCommits.length - totalCommits

  const chartData = useMemo(() => {
    const rows = visibleContributors.map((c) => ({
      name: c.label,
      commits: c.commits,
      secondary: c.login ? `@${c.login}` : undefined,
    }))
    if (rows.length === 0) return []
    return [
      {
        name: excludedNames.length > 0 ? 'Total (selected)' : 'Total',
        commits: totalCommits,
        secondary: `${rows.length} contributor${rows.length === 1 ? '' : 's'}`,
        isTotal: true,
      },
      ...rows,
    ]
  }, [visibleContributors, totalCommits, excludedNames.length])

  function handleDownloadCsv() {
    if (scannedCommits.length === 0) return

    const repoPart = sanitizeFilenamePart(repoMeta?.full_name ?? 'repo')
    const branchPart = sanitizeFilenamePart(
      allBranches ? 'all-branches' : normalizeBranchName(branch) || 'HEAD',
    )
    const filename = `${repoPart}-${branchPart}-commits.csv`
    downloadCsv(filename, commitsToCsv(scannedCommits))
  }

  async function handleLoadCsvFile(file: File) {
    setError(null)
    setWarning(null)
    setProgress('')

    try {
      const text = await file.text()
      const commits = commitsFromCsv(text)
      const byAuthor = aggregateCommitsByAuthor(commits)
      setScannedCommits(commits)
      setContributors(byAuthor)
      setExcludedNames([])
      setReportTitle(`Loaded from ${file.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CSV.')
    }
  }

  const handleLoadCsvUrl = useCallback(async (urlInput: string) => {
    setError(null)
    setWarning(null)
    setLoadingCsvUrl(true)
    setProgress('Fetching CSV…')

    try {
      const rawUrl = normalizeGithubCsvUrl(urlInput)
      const response = await fetch(rawUrl)
      if (!response.ok) {
        throw new Error(
          `Failed to fetch CSV (${response.status} ${response.statusText}).`,
        )
      }
      const text = await response.text()
      const commits = commitsFromCsv(text)
      const byAuthor = aggregateCommitsByAuthor(commits)
      setScannedCommits(commits)
      setContributors(byAuthor)
      setExcludedNames([])
      setReportTitle(`Loaded from ${csvUrlBasename(rawUrl)}`)
      setCsvUrl(urlInput.trim())
      setProgress('')
    } catch (err) {
      setProgress('')
      setError(err instanceof Error ? err.message : 'Failed to load CSV.')
    } finally {
      setLoadingCsvUrl(false)
    }
  }, [])

  useEffect(() => {
    if (csvQueryLoaded.current) return
    const params = new URLSearchParams(window.location.search)
    const csvParam = params.get('csv')
    if (!csvParam) return
    csvQueryLoaded.current = true
    const decoded = csvParam.trim()
    setCsvUrl(decoded)
    void handleLoadCsvUrl(decoded)
  }, [handleLoadCsvUrl])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-2">
        <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Git Commit Report
        </p>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed sm:text-base">
          Paste a GitHub repo URL, pick a branch, and chart commits by contributor.
          After generating, toggle author names to exclude them from the chart.
        </p>
      </header>

      <main className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Repository</CardTitle>
            <CardDescription>
              Load branches first if you want to browse them, or type a branch name
              directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RepoForm
              repoUrl={repoUrl}
              onRepoUrlChange={setRepoUrl}
              branch={branch}
              onBranchChange={setBranch}
              branches={branches}
              defaultBranch={defaultBranch}
              allBranches={allBranches}
              onAllBranchesChange={setAllBranches}
              token={token}
              onTokenChange={setToken}
              loadingBranches={loadingBranches}
              generating={generating}
              loadingCsvUrl={loadingCsvUrl}
              csvUrl={csvUrl}
              onCsvUrlChange={setCsvUrl}
              onLoadBranches={loadBranches}
              onGenerate={generateReport}
              onLoadCsvFile={handleLoadCsvFile}
              onLoadCsvUrl={handleLoadCsvUrl}
            />
          </CardContent>
        </Card>

        {(progress || error || warning) && (
          <div className="grid gap-2" aria-live="polite">
            {progress && (
              <Alert>
                <InfoIcon />
                <AlertTitle>Working</AlertTitle>
                <AlertDescription>{progress}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {warning && (
              <Alert>
                <AlertCircleIcon />
                <AlertTitle>Partial results</AlertTitle>
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {reportTitle && (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>{reportTitle}</CardTitle>
                <CardDescription>
                  {totalCommits} commit{totalCommits === 1 ? '' : 's'} ·{' '}
                  {visibleContributors.length} contributor
                  {visibleContributors.length === 1 ? '' : 's'}
                  {excludedCommitCount > 0
                    ? ` · ${excludedCommitCount} excluded`
                    : ''}
                  {` · ${scannedCommits.length} total`}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={scannedCommits.length === 0}
                onClick={handleDownloadCsv}
              >
                <DownloadIcon data-icon="inline-start" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <ContributorExcludeList
                names={authorNames}
                excludedNames={excludedNames}
                onToggle={toggleExcluded}
              />
              <CommitChart
                data={chartData}
                emptyMessage="No contributors left after exclusions."
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
