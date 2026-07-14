import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { normalizeAuthorName } from '@/lib/aggregate'

type ContributorExcludeListProps = {
  names: { name: string; commits: number }[]
  excludedNames: string[]
  onToggle: (name: string, excluded: boolean) => void
}

export function ContributorExcludeList({
  names,
  excludedNames,
  onToggle,
}: ContributorExcludeListProps) {
  if (names.length === 0) return null

  const excluded = new Set(excludedNames.map(normalizeAuthorName))

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Include / exclude by author name</p>
      <ul className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
        {names.map(({ name, commits }) => {
          const id = `exclude-${normalizeAuthorName(name)}`
          const isExcluded = excluded.has(normalizeAuthorName(name))
          return (
            <li key={name} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={!isExcluded}
                onCheckedChange={(checked) => {
                  onToggle(name, checked !== true)
                }}
              />
              <Label htmlFor={id} className="cursor-pointer font-normal">
                {name}
                <span className="text-muted-foreground ml-1 text-xs">
                  ({commits})
                </span>
              </Label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
