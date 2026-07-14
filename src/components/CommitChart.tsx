import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type ChartRow = {
  name: string
  commits: number
  secondary?: string
  isTotal?: boolean
}

type CommitChartProps = {
  data: ChartRow[]
  emptyMessage?: string
}

export function CommitChart({ data, emptyMessage }: CommitChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-sm">
        {emptyMessage ?? 'No data to chart.'}
      </p>
    )
  }

  const height = Math.max(280, data.length * 36)

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <Tooltip
            formatter={(value) => [String(value ?? 0), 'Commits']}
            labelFormatter={(label, payload) => {
              const secondary = payload?.[0]?.payload?.secondary as string | undefined
              return secondary ? `${label} · ${secondary}` : String(label)
            }}
          />
          <Bar dataKey="commits" radius={[0, 4, 4, 0]}>
            {data.map((row, index) => (
              <Cell
                key={`${row.name}-${index}`}
                fill={row.isTotal ? 'var(--chart-1)' : 'var(--chart-3)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
