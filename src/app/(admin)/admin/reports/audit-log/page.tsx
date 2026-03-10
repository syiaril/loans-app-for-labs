'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ACTION_LABELS, formatDateTime } from '@/lib/utils'
import { ClipboardList, Loader2, Search } from 'lucide-react'
import type { AuditLog, Profile } from '@/lib/types/database'

export default function AuditLogPage() {
    const [logs, setLogs] = useState<(AuditLog & { user?: Profile })[]>([])
    const [loading, setLoading] = useState(true)
    const [actionFilter, setActionFilter] = useState('all')
    const [page, setPage] = useState(0)
    const perPage = 50

    useEffect(() => { loadLogs() }, [page])

    async function loadLogs() {
        setLoading(true)
        const supabase = createClient()
        let query = supabase.from('audit_logs').select('*, user:profiles(name)')
        if (actionFilter !== 'all') query = query.eq('action', actionFilter)
        const { data } = await query.order('created_at', { ascending: false }).range(page * perPage, (page + 1) * perPage - 1)
        setLogs(data || [])
        setLoading(false)
    }

    const actionColors: Record<string, string> = {
        login: 'bg-blue-500/20 text-blue-400', logout: 'bg-gray-500/20 text-gray-400',
        borrow: 'bg-indigo-500/20 text-indigo-400', return: 'bg-emerald-500/20 text-emerald-400',
        create: 'bg-green-500/20 text-green-400', update: 'bg-yellow-500/20 text-yellow-400',
        delete: 'bg-red-500/20 text-red-400', approve: 'bg-purple-500/20 text-purple-400',
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ClipboardList className="w-6 h-6" />Log Audit
                </h1>
                <p className="text-muted-foreground">Riwayat semua aktivitas sistem</p>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <div className="flex gap-3">
                        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setTimeout(loadLogs, 0) }}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Jenis Aksi" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Aksi</SelectItem>
                                {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Waktu</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Aksi</TableHead>
                                        <TableHead>Deskripsi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs whitespace-nowrap">{formatDateTime(log.created_at)}</TableCell>
                                            <TableCell className="text-sm">{(log.user as Profile)?.name || 'Sistem'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-xs ${actionColors[log.action] || ''}`}>
                                                    {ACTION_LABELS[log.action] || log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.description || '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {logs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada log</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    <div className="flex items-center justify-between mt-4">
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button>
                        <span className="text-sm text-muted-foreground">Halaman {page + 1}</span>
                        <Button variant="outline" size="sm" disabled={logs.length < perPage} onClick={() => setPage(p => p + 1)}>Selanjutnya</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
