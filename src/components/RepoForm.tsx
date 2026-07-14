import { useRef, type FormEvent } from 'react'
import { LinkIcon, UploadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BranchSelect } from './BranchSelect'
import { TokenSettings } from './TokenSettings'

type RepoFormProps = {
  repoUrl: string
  onRepoUrlChange: (value: string) => void
  branch: string
  onBranchChange: (value: string) => void
  branches: string[]
  defaultBranch?: string
  allBranches: boolean
  onAllBranchesChange: (all: boolean) => void
  token: string
  onTokenChange: (token: string) => void
  loadingBranches: boolean
  generating: boolean
  loadingCsvUrl: boolean
  csvUrl: string
  onCsvUrlChange: (value: string) => void
  onLoadBranches: () => void
  onGenerate: () => void
  onLoadCsvFile: (file: File) => void
  onLoadCsvUrl: (url: string) => void
}

export function RepoForm({
  repoUrl,
  onRepoUrlChange,
  branch,
  onBranchChange,
  branches,
  defaultBranch,
  allBranches,
  onAllBranchesChange,
  token,
  onTokenChange,
  loadingBranches,
  generating,
  loadingCsvUrl,
  csvUrl,
  onCsvUrlChange,
  onLoadBranches,
  onGenerate,
  onLoadCsvFile,
  onLoadCsvUrl,
}: RepoFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onGenerate()
  }

  const busy = loadingBranches || generating || loadingCsvUrl

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="repo-url">GitHub repository</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="repo-url"
            type="text"
            value={repoUrl}
            onChange={(e) => onRepoUrlChange(e.target.value)}
            placeholder="https://github.com/owner/repo"
            disabled={busy}
            required
            className="min-w-[240px] flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={onLoadBranches}
            disabled={busy || !repoUrl.trim()}
          >
            {loadingBranches
              ? 'Loading…'
              : branches.length > 0
                ? `Branches (${branches.length})`
                : 'Load branches'}
          </Button>
        </div>
      </div>

      <BranchSelect
        branches={branches}
        value={branch}
        onChange={onBranchChange}
        allBranches={allBranches}
        onAllBranchesChange={onAllBranchesChange}
        disabled={busy}
        defaultBranch={defaultBranch}
      />

      <TokenSettings token={token} onTokenChange={onTokenChange} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !repoUrl.trim()}>
          {generating ? 'Generating…' : 'Generate report'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onLoadCsvFile(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon data-icon="inline-start" />
          Load CSV
        </Button>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="csv-url">Load CSV from URL</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="csv-url"
            type="url"
            value={csvUrl}
            onChange={(e) => onCsvUrlChange(e.target.value)}
            placeholder="https://github.com/owner/repo/blob/main/SavedCSVs/file.csv"
            disabled={busy}
            className="min-w-[240px] flex-1"
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || !csvUrl.trim()}
            onClick={() => onLoadCsvUrl(csvUrl)}
          >
            <LinkIcon data-icon="inline-start" />
            {loadingCsvUrl ? 'Loading…' : 'Load URL'}
          </Button>
        </div>
      </div>
    </form>
  )
}
