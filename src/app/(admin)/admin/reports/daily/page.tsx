'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABELS, STATUS_COLORS, formatDateTime } from '@/lib/utils'
import { Calendar, Download, Loader2, Package, Undo2 } from 'lucide-react'
import type { Loan, Profile } from '@/lib/types/database'
import useSWR from 'swr'
import { useAuth } from '@/hooks/use-auth'
import { CardSkeleton } from '@/components/skeletons'

export default function DailyReportPage() {
    const { user } = useAuth()
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const supabase = createClient()

    // 1. Fetch Data with SWR
    const { data: reportData, isLoading } = useSWR(user ? ['report-daily', date] : null, async () => {
        const startOfDay = `${date}T00:00:00.000Z`
        const endOfDay = `${date}T23:59:59.999Z`

        const [loansRes, returnsRes] = await Promise.all([
            supabase.from('loans')
                .select('*, user:profiles!loans_user_id_fkey(name, department), loan_items(id)')
                .gte('created_at', startOfDay).lte('created_at', endOfDay)
                .order('created_at', { ascending: false }),
            supabase.from('loan_items')
                .select('id, returned_at, condition_after, item:items(name), loan:loans(loan_code)')
                .gte('returned_at', startOfDay).lte('returned_at', endOfDay)
                .order('returned_at', { ascending: false })
        ])

        const loans = (loansRes.data || []) as (Loan & { user?: Profile; loan_items?: { id: number }[] })[]
        const returns = (returnsRes.data || []).map((r: any) => ({
            id: r.id,
            item_name: r.item?.name || '',
            loan_code: r.loan?.loan_code || '',
            returned_at: r.returned_at,
            condition_after: r.condition_after || 'good',
        }))

        return {
            loans,
            returns,
            stats: {
                loans: loans.length,
                returns: returns.length,
                itemsBorrowed: loans.reduce((a, l) => a + (l.loan_items?.length || 0), 0),
                itemsReturned: returns.length,
            }
        }
    })

    const loans = reportData?.loans || []
    const returns = reportData?.returns || []
    const stats = reportData?.stats || { loans: 0, returns: 0, itemsBorrowed: 0, itemsReturned: 0 }

    async function handleExport() {
        window.open(`/api/reports/daily-export?date=${date}`, '_blank')
    }

    if (!user) return null

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Laporan Harian</h1>
                    <p className="text-muted-foreground">Ringkasan aktivitas per hari</p>
                </div>
                <div className="flex items-center gap-2">
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
                    <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" />Export Excel</Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Peminjaman', value: stats.loans, icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Pengembalian', value: stats.returns, icon: Undo2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Item Dipinjam', value: stats.itemsBorrowed, icon: Package, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { label: 'Item Dikembalikan', value: stats.itemsReturned, icon: Package, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                ].map(s => (
                    <Card key={s.label} className="backdrop-blur-xl bg-card/80 border-border/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                                    <s.icon className={`w-5 h-5 ${s.color}`} />
                                </div>
                                <div><p className="text-xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-6">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            ) : (
                <>
                    <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                        <CardHeader><CardTitle className="text-base">Peminjaman Hari Ini</CardTitle></CardHeader>
                        <CardContent>
                            {loans.length === 0 ? <p className="text-center py-4 text-muted-foreground">Tidak ada peminjaman</p> : (
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead>Kode</TableHead><TableHead>Peminjam</TableHead><TableHead>Jml</TableHead><TableHead>Status</TableHead><TableHead>Waktu</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {loans.map(l => (
                                            <TableRow key={l.id}>
                                                <TableCell><code className="text-xs">{l.loan_code}</code></TableCell>
                                                <TableCell className="text-sm">{(l.user as Profile)?.name}</TableCell>
                                                <TableCell><Badge variant="secondary">{l.loan_items?.length}</Badge></TableCell>
                                                <TableCell><Badge variant="outline" className={`text-xs ${STATUS_COLORS[l.status]}`}>{STATUS_LABELS[l.status]}</Badge></TableCell>
                                                <TableCell className="text-xs">{formatDateTime(l.created_at)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                        <CardHeader><CardTitle className="text-base">Pengembalian Hari Ini</CardTitle></CardHeader>
                        <CardContent>
                            {returns.length === 0 ? <p className="text-center py-4 text-muted-foreground">Tidak ada pengembalian</p> : (
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead>Barang</TableHead><TableHead>Kode Pinjam</TableHead><TableHead>Kondisi</TableHead><TableHead>Waktu</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {returns.map(r => (
                                            <TableRow key={r.id}>
                                                <TableCell className="text-sm">{r.item_name}</TableCell>
                                                <TableCell><code className="text-xs">{r.loan_code}</code></TableCell>
                                                <TableCell className="text-sm">{r.condition_after}</TableCell>
                                                <TableCell className="text-xs">{formatDateTime(r.returned_at)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
