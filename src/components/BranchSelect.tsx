import { useMemo, useState } from 'react'
import { ChevronsUpDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { normalizeBranchName } from '@/lib/github'

type BranchSelectProps = {
  branches: string[]
  value: string
  onChange: (branch: string) => void
  allBranches: boolean
  onAllBranchesChange: (all: boolean) => void
  disabled?: boolean
  defaultBranch?: string
}

export function BranchSelect({
  branches,
  value,
  onChange,
  allBranches,
  onAllBranchesChange,
  disabled,
  defaultBranch,
}: BranchSelectProps) {
  const [open, setOpen] = useState(false)

  const normalizedValue = useMemo(() => normalizeBranchName(value), [value])

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="branch">Branch</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            id="all-branches"
            checked={allBranches}
            disabled={disabled}
            onCheckedChange={(checked) => onAllBranchesChange(checked === true)}
          />
          <Label htmlFor="all-branches" className="cursor-pointer font-normal">
            All branches
          </Label>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          id="branch"
          value={allBranches ? 'All branches' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="main or origin/dev_main"
          disabled={disabled || allBranches}
          className="flex-1"
          autoComplete="off"
        />
        {branches.length > 0 && !allBranches && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                aria-label="Browse branches"
                className="shrink-0"
              >
                <ChevronsUpDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search branches…" />
                <CommandList>
                  <CommandEmpty>No branch found.</CommandEmpty>
                  <CommandGroup>
                    {branches.map((name) => (
                      <CommandItem
                        key={name}
                        value={name}
                        data-checked={normalizedValue === name || undefined}
                        onSelect={() => {
                          onChange(name)
                          setOpen(false)
                        }}
                      >
                        <span className="truncate">
                          {name}
                          {defaultBranch === name ? ' (default)' : ''}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {allBranches ? (
          <>
            Loads every branch in the repo and counts each commit once (deduped by
            SHA). Use <strong>Load branches</strong> first, or it will fetch the
            branch list when you generate.
          </>
        ) : (
          <>
            Tip: <code className="font-mono">origin/dev_main</code> is normalized
            to <code className="font-mono">dev_main</code> for the API. Type
            freely anytime; use the browse button after loading branches.
          </>
        )}
      </p>
    </div>
  )
}
