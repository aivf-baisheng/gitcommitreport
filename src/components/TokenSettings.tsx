import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getStoredToken, setStoredToken } from '@/lib/github'

type TokenSettingsProps = {
  token: string
  onTokenChange: (token: string) => void
}

export function TokenSettings({ token, onTokenChange }: TokenSettingsProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(token)

  useEffect(() => {
    setDraft(token)
  }, [token])

  function save() {
    setStoredToken(draft)
    onTokenChange(getStoredToken())
    setOpen(false)
  }

  function clear() {
    setDraft('')
    setStoredToken('')
    onTokenChange('')
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="grid gap-2">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="link" className="h-auto justify-start px-0">
          {open ? 'Hide' : 'Optional'} GitHub token
          {token ? ' (saved)' : ''}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="grid gap-3 rounded-lg border border-dashed p-3">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Stored only in this browser via localStorage. Use a fine-grained or classic
          PAT for higher rate limits or private repos (
          <code className="font-mono">public_repo</code> /{' '}
          <code className="font-mono">repo</code>).
        </p>
        <div className="grid gap-2">
          <Label htmlFor="token">Personal access token</Label>
          <Input
            id="token"
            type="password"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ghp_… or github_pat_…"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            Save token
          </Button>
          <Button type="button" variant="secondary" onClick={clear}>
            Clear
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
