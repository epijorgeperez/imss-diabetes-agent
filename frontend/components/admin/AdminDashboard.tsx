'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Users,
  Activity,
  Clock,
  RefreshCw,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Wrench,
  BarChart3,
  Shield,
  Globe,
  MessageSquare,
  Bot,
  User,
  Code,
  Loader2,
  X,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface StatsData {
  total_users: number
  total_requests: number
  avg_duration_ms: number
  top_users: { email: string; request_count: number; last_active: string }[]
  requests_per_day: { day: string; count: number }[]
  popular_tools: { tool: string; count: number }[]
  anomalies: {
    multi_ip_users: { email: string; ip_count: number }[]
    multi_user_ips: { ip: string; user_count: number }[]
  }
}

interface UserRecord {
  id: number
  nombre: string
  email: string
  adscripcion: string
  created_at: string
  last_login: string | null
}

interface UsageLog {
  id: number
  user_email: string
  chat_id: string
  endpoint: string
  message_preview: string | null
  tools_used: string | null
  response_duration_ms: number | null
  ip_address: string | null
  created_at: string
}

interface ThreadMessage {
  type: 'message' | 'function_call' | 'function_call_output'
  role?: 'user' | 'assistant'
  content?: string | { text: string; type: string }[]
  name?: string
  arguments?: string
  output?: string
  call_id?: string
  agent?: string
  timestamp?: number
  status?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_BASE = '/api/admin'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Justo ahora'
  if (diffMin < 60) return `hace ${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `hace ${diffD}d`
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function parseToolsUsed(raw: string | null): string[] {
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [logsCount, setLogsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Filters
  const [emailFilter, setEmailFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [logsLimit, setLogsLimit] = useState(100)

  // Collapsible sections
  const [showUsers, setShowUsers] = useState(true)
  const [showLogs, setShowLogs] = useState(true)
  const [showAnomalies, setShowAnomalies] = useState(true)

  // Expandable log rows
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [threadCache, setThreadCache] = useState<Record<string, ThreadMessage[]>>({})
  const [threadLoading, setThreadLoading] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        fetch(`${ADMIN_BASE}/stats`),
        fetch(`${ADMIN_BASE}/users`),
        fetch(buildLogsUrl()),
      ])

      if (!statsRes.ok || !usersRes.ok || !logsRes.ok) {
        throw new Error('Error al obtener datos del backend')
      }

      const [statsData, usersData, logsData] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
        logsRes.json(),
      ])

      setStats(statsData)
      setUsers(usersData.users || [])
      setLogs(logsData.logs || [])
      setLogsCount(logsData.count || 0)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function buildLogsUrl() {
    const params = new URLSearchParams()
    if (emailFilter) params.set('email', emailFilter)
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    params.set('limit', String(logsLimit))
    return `${ADMIN_BASE}/usage?${params.toString()}`
  }

  async function fetchLogs() {
    try {
      const res = await fetch(buildLogsUrl())
      if (!res.ok) throw new Error('Error fetching logs')
      const data = await res.json()
      setLogs(data.logs || [])
      setLogsCount(data.count || 0)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function toggleThread(logId: number, chatId: string) {
    if (expandedLogId === logId) {
      setExpandedLogId(null)
      return
    }
    setExpandedLogId(logId)
    if (threadCache[chatId]) return // already cached
    setThreadLoading(chatId)
    try {
      const res = await fetch(`${ADMIN_BASE}/thread/${chatId}`)
      if (!res.ok) {
        // Thread file might not exist (e.g. no persistence for that chat)
        setThreadCache((prev) => ({ ...prev, [chatId]: [] }))
        return
      }
      const data = await res.json()
      setThreadCache((prev) => ({ ...prev, [chatId]: data.messages || [] }))
    } catch {
      setThreadCache((prev) => ({ ...prev, [chatId]: [] }))
    } finally {
      setThreadLoading(null)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading && !stats) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchAll}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const maxDayCount = stats?.requests_per_day?.length
    ? Math.max(...stats.requests_per_day.map((d) => d.count))
    : 1

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              dev-only
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Actualizado {lastRefresh.toLocaleTimeString('es-MX')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAll}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container space-y-6 px-4 py-6">
        {/* ── Stats Cards ──────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Usuarios registrados"
            value={stats?.total_users ?? 0}
          />
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Total requests"
            value={stats?.total_requests ?? 0}
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Duración promedio"
            value={formatDuration(stats?.avg_duration_ms ?? 0)}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Anomalías detectadas"
            value={
              (stats?.anomalies?.multi_ip_users?.length ?? 0) +
              (stats?.anomalies?.multi_user_ips?.length ?? 0)
            }
            variant={
              (stats?.anomalies?.multi_ip_users?.length ?? 0) +
                (stats?.anomalies?.multi_user_ips?.length ?? 0) >
              0
                ? 'warning'
                : 'default'
            }
          />
        </div>

        {/* ── Requests per Day + Top Users + Popular Tools ──────── */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Bar chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Requests por día (últimos 30 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.requests_per_day?.length ? (
                <div className="space-y-1.5">
                  {[...stats.requests_per_day].reverse().map((d) => (
                    <div key={d.day} className="flex items-center gap-2 text-xs">
                      <span className="w-20 shrink-0 text-muted-foreground">
                        {new Date(d.day + 'T00:00:00').toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                      <div className="flex-1">
                        <div
                          className="h-5 rounded-sm bg-primary/80 transition-all"
                          style={{
                            width: `${Math.max((d.count / maxDayCount) * 100, 2)}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right font-medium">{d.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos aún</p>
              )}
            </CardContent>
          </Card>

          {/* Top users + popular tools */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Top usuarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.top_users?.length ? (
                  <div className="space-y-2">
                    {stats.top_users.slice(0, 5).map((u, i) => (
                      <div
                        key={u.email}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {i + 1}
                          </span>
                          <span className="truncate" title={u.email}>
                            {u.email.split('@')[0]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium">{u.request_count}</span>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(u.last_active)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4" />
                  Herramientas populares
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.popular_tools?.length ? (
                  <div className="space-y-2">
                    {stats.popular_tools.map((t) => (
                      <div
                        key={t.tool}
                        className="flex items-center justify-between text-sm"
                      >
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {t.tool}
                        </code>
                        <span className="font-medium">{t.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Users Table ──────────────────────────────────────────── */}
        <Card>
          <CardHeader
            className="cursor-pointer pb-3"
            onClick={() => setShowUsers(!showUsers)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Usuarios registrados
                </CardTitle>
                <CardDescription>{users.length} usuarios</CardDescription>
              </div>
              {showUsers ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {showUsers && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4">Nombre</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4">Adscripción</th>
                      <th className="pb-2 pr-4">Registro</th>
                      <th className="pb-2">Último acceso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{u.nombre}</td>
                        <td className="py-2 pr-4">
                          <button
                            className="text-primary underline-offset-2 hover:underline"
                            onClick={() => {
                              setEmailFilter(u.email)
                              setShowLogs(true)
                              fetchLogs()
                            }}
                            title="Filtrar logs por este usuario"
                          >
                            {u.email}
                          </button>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {u.adscripcion}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="py-2">
                          <span
                            title={formatDate(u.last_login)}
                            className="text-muted-foreground"
                          >
                            {timeAgo(u.last_login)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-4 text-center text-muted-foreground"
                        >
                          No hay usuarios registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Usage Logs ───────────────────────────────────────────── */}
        <Card>
          <CardHeader
            className="cursor-pointer pb-3"
            onClick={() => setShowLogs(!showLogs)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Logs de uso
                </CardTitle>
                <CardDescription>
                  {logsCount} registros{emailFilter ? ` (filtrado: ${emailFilter})` : ''}
                </CardDescription>
              </div>
              {showLogs ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {showLogs && (
            <CardContent>
              {/* Filters */}
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Email</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="h-9 w-56 pl-8 text-sm"
                      placeholder="usuario@imss.gob.mx"
                      value={emailFilter}
                      onChange={(e) => setEmailFilter(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Desde</label>
                  <Input
                    type="date"
                    className="h-9 w-40 text-sm"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hasta</label>
                  <Input
                    type="date"
                    className="h-9 w-40 text-sm"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Límite</label>
                  <Input
                    type="number"
                    className="h-9 w-20 text-sm"
                    value={logsLimit}
                    min={1}
                    max={1000}
                    onChange={(e) => setLogsLimit(Number(e.target.value) || 100)}
                  />
                </div>
                <Button size="sm" className="h-9" onClick={fetchLogs}>
                  <Search className="mr-1 h-3.5 w-3.5" />
                  Buscar
                </Button>
                {emailFilter && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9"
                    onClick={() => {
                      setEmailFilter('')
                      setFromDate('')
                      setToDate('')
                      setLogsLimit(100)
                      // Refetch with clean state after a tick
                      setTimeout(() => fetchLogs(), 50)
                    }}
                  >
                    Limpiar
                  </Button>
                )}
              </div>

              {/* Logs table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 w-6"></th>
                      <th className="pb-2 pr-3">Fecha</th>
                      <th className="pb-2 pr-3">Usuario</th>
                      <th className="pb-2 pr-3">Endpoint</th>
                      <th className="pb-2 pr-3">Preview</th>
                      <th className="pb-2 pr-3">Tools</th>
                      <th className="pb-2 pr-3">Duración</th>
                      <th className="pb-2">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const isExpanded = expandedLogId === log.id
                      const thread = threadCache[log.chat_id]
                      const isLoadingThread = threadLoading === log.chat_id
                      return (
                        <LogRow
                          key={log.id}
                          log={log}
                          isExpanded={isExpanded}
                          thread={thread}
                          isLoadingThread={isLoadingThread}
                          onToggle={() => toggleThread(log.id, log.chat_id)}
                          onFilterEmail={(email) => {
                            setEmailFilter(email)
                            fetchLogs()
                          }}
                        />
                      )
                    })}
                    {logs.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-4 text-center text-muted-foreground"
                        >
                          No hay logs de uso
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Anomalies ────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            className="cursor-pointer pb-3"
            onClick={() => setShowAnomalies(!showAnomalies)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  Detección de anomalías
                </CardTitle>
                <CardDescription>
                  Suplantación de identidad y cuentas compartidas
                </CardDescription>
              </div>
              {showAnomalies ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {showAnomalies && (
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Multi-IP users */}
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Globe className="h-3.5 w-3.5" />
                    Emails desde múltiples IPs (&gt;2)
                  </h4>
                  {stats?.anomalies?.multi_ip_users?.length ? (
                    <div className="space-y-1">
                      {stats.anomalies.multi_ip_users.map((a) => (
                        <div
                          key={a.email}
                          className="flex items-center justify-between rounded bg-destructive/5 px-3 py-1.5 text-sm"
                        >
                          <span>{a.email}</span>
                          <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            {a.ip_count} IPs
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sin anomalías detectadas
                    </p>
                  )}
                </div>

                {/* Multi-user IPs */}
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Users className="h-3.5 w-3.5" />
                    IPs con múltiples usuarios
                  </h4>
                  {stats?.anomalies?.multi_user_ips?.length ? (
                    <div className="space-y-1">
                      {stats.anomalies.multi_user_ips.map((a) => (
                        <div
                          key={a.ip}
                          className="flex items-center justify-between rounded bg-destructive/5 px-3 py-1.5 text-sm"
                        >
                          <code className="text-xs">{a.ip}</code>
                          <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            {a.user_count} usuarios
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sin anomalías detectadas
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  variant?: 'default' | 'warning'
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            variant === 'warning'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary'
          }`}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── LogRow (expandable) ──────────────────────────────────────────────────────

function LogRow({
  log,
  isExpanded,
  thread,
  isLoadingThread,
  onToggle,
  onFilterEmail,
}: {
  log: UsageLog
  isExpanded: boolean
  thread: ThreadMessage[] | undefined
  isLoadingThread: boolean
  onToggle: () => void
  onFilterEmail: (email: string) => void
}) {
  return (
    <>
      <tr
        className={`border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/50 ${
          isExpanded ? 'bg-muted/30' : ''
        }`}
        onClick={onToggle}
      >
        <td className="py-2 pl-1">
          {isLoadingThread ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <ChevronRight
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          )}
        </td>
        <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
          <span title={formatDate(log.created_at)}>
            {timeAgo(log.created_at)}
          </span>
        </td>
        <td className="py-2 pr-3">
          <button
            className="text-primary underline-offset-2 hover:underline text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onFilterEmail(log.user_email)
            }}
          >
            {log.user_email.split('@')[0]}
          </button>
        </td>
        <td className="py-2 pr-3">
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {log.endpoint}
          </code>
        </td>
        <td
          className="max-w-[300px] truncate py-2 pr-3 text-xs text-muted-foreground"
          title={log.message_preview || ''}
        >
          {log.message_preview || '—'}
        </td>
        <td className="py-2 pr-3">
          <div className="flex flex-wrap gap-1">
            {parseToolsUsed(log.tools_used).map((t) => (
              <span
                key={t}
                className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
              >
                {t}
              </span>
            ))}
          </div>
        </td>
        <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">
          {formatDuration(log.response_duration_ms)}
        </td>
        <td className="py-2 text-xs text-muted-foreground">
          {log.ip_address || '—'}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="border-b bg-muted/20 px-4 py-3">
              {/* Chat ID header */}
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span>chat_id: </span>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                  {log.chat_id}
                </code>
              </div>
              {isLoadingThread ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando conversación...
                </div>
              ) : thread && thread.length > 0 ? (
                <ThreadViewer messages={thread} />
              ) : (
                <p className="py-2 text-xs text-muted-foreground italic">
                  No se encontró hilo de conversación para este chat_id
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── ThreadViewer ─────────────────────────────────────────────────────────────

function getMessageText(content: string | { text: string; type: string }[] | undefined): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : c.text || ''))
      .filter(Boolean)
      .join('\n')
  }
  return String(content)
}

function ThreadViewer({ messages }: { messages: ThreadMessage[] }) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())

  function toggleTool(callId: string) {
    setExpandedTools((prev) => {
      const next = new Set(prev)
      next.has(callId) ? next.delete(callId) : next.add(callId)
      return next
    })
  }

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
      {messages.map((msg, idx) => {
        // ── User message ──
        if (msg.type === 'message' && msg.role === 'user') {
          const text = getMessageText(msg.content)
          return (
            <div key={idx} className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <User className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-blue-700 mb-0.5">Usuario</p>
                <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
              </div>
            </div>
          )
        }

        // ── Assistant message ──
        if (msg.type === 'message' && msg.role === 'assistant') {
          const text = getMessageText(msg.content)
          return (
            <div key={idx} className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Bot className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-emerald-700 mb-0.5">Agente</p>
                <div className="text-sm whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
                  {text}
                </div>
              </div>
            </div>
          )
        }

        // ── Tool call ──
        if (msg.type === 'function_call') {
          const callId = msg.call_id || `fc-${idx}`
          const isOpen = expandedTools.has(callId)
          // Find matching output
          const outputMsg = messages.find(
            (m) => m.type === 'function_call_output' && m.call_id === msg.call_id
          )
          return (
            <div key={idx} className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Code className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <button
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900"
                  onClick={() => toggleTool(callId)}
                >
                  <ChevronRight
                    className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                  {msg.name || 'Tool'}
                  {msg.status === 'completed' && (
                    <span className="text-emerald-600 font-normal">OK</span>
                  )}
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1">
                    {msg.arguments && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                          Argumentos
                        </p>
                        <pre className="rounded bg-muted p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(msg.arguments!), null, 2)
                            } catch {
                              return msg.arguments
                            }
                          })()}
                        </pre>
                      </div>
                    )}
                    {outputMsg?.output && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                          Resultado
                        </p>
                        <pre className="rounded bg-muted p-2 text-xs overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                          {outputMsg.output}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        }

        // Skip function_call_output (rendered inline with function_call)
        if (msg.type === 'function_call_output') return null

        return null
      })}
    </div>
  )
}
