'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ACTION_LABELS, formatDateTime } from '@/lib/utils'
import { ClipboardList, Loader2, Search } from 'lucide-react'
import DataPagination from '@/components/data-pagination'
import { TableSkeleton } from '@/components/skeletons'
import type { AuditLog, Profile } from '@/lib/types/database'

export default function AuditLogPage() {
    const perPage = 10
    const [actionFilter, setActionFilter] = useState('all')
    const [page, setPage] = useState(0)

    const supabase = createClient()

    // 1. Build SWR key
    const logsKey = useMemo(() => {
        return ['audit_logs', page, actionFilter]
    }, [page, actionFilter])

    // 2. Fetch with SWR
    const { data: logsData, error: logsError, isLoading: logsLoading } = useSWR(logsKey, async () => {
        let query = supabase.from('audit_logs').select('*, user:profiles(name)')
        if (actionFilter !== 'all') query = query.eq('action', actionFilter)
        
        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(page * perPage, (page + 1) * perPage - 1)
        
        if (error) throw error
        return { logs: data || [], total: count || 0 }
    }, {
        keepPreviousData: true,
        revalidateOnFocus: false
    })

    const logs = (logsData?.logs || []) as (AuditLog & { user?: Profile })[]
    const loading = logsLoading && !logsData

    // Reset pagination when filter changes
    useEffect(() => {
        setPage(0)
    }, [actionFilter])

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
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-[180px] shrink-0"><SelectValue placeholder="Jenis Aksi" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Aksi</SelectItem>
                                {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
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
                                <TableSkeleton columns={4} rows={10} />
                            </Table>
                        </div>
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
                    <DataPagination page={page} perPage={perPage} currentCount={logs.length} onPageChange={setPage} />
                </CardContent>
            </Card>
        </div>
    )
}
