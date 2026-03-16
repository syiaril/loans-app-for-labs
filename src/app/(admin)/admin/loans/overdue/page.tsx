'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { STATUS_LABELS, STATUS_COLORS, formatDateTime } from '@/lib/utils'
import { AlertTriangle, Loader2, Eye } from 'lucide-react'
import Link from 'next/link'
import type { Loan, Profile } from '@/lib/types/database'

export default function OverdueLoansPage() {
    const { profile: currentUser } = useAuth()
    const [loans, setLoans] = useState<(Loan & { user?: Profile })[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshSignal, setRefreshSignal] = useState(0)

    const supabase = createClient()

    useEffect(() => {
        let isMounted = true

        async function initAndLoad() {
            setLoading(true)
            const now = new Date().toISOString()
            
            // Fetch items where status is 'overdue' OR (active statuses AND due_date < now)
            const { data, error } = await supabase.from('loans')
                .select('*, user:profiles!loans_user_id_fkey(name, department), loan_items(id)')
                .or(`status.eq.overdue,and(status.eq.borrowed,due_date.lt.${now}),and(status.eq.partial_return,due_date.lt.${now})`)
                .order('due_date', { ascending: true })
            
            if (!isMounted) return

            if (data && !error) {
                setLoans(data)
            }
            setLoading(false)
        }

        initAndLoad()
        return () => { isMounted = false }
    }, [refreshSignal])

    const refresh = () => setRefreshSignal(s => s + 1)

    async function markAllOverdue() {
        const now = new Date().toISOString()
        const { count } = await supabase.from('loans').update({ status: 'overdue' })
            .in('status', ['borrowed', 'partial_return']).lt('due_date', now)
        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'update', model_type: 'loan', description: `Menandai ${count || 0} peminjaman terlambat (batch)` })
        toast.success(`${count || 0} peminjaman ditandai terlambat secara permanen`)
        refresh()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6 text-red-500" />Peminjaman Terlambat
                    </h1>
                    <p className="text-muted-foreground">Daftar peminjaman yang melewati jatuh tempo</p>
                </div>
                <Button variant="destructive" className="font-bold tracking-tight px-6" onClick={markAllOverdue}>Tandai Semua Terlambat</Button>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
                    ) : loans.length === 0 ? (
                        <div className="py-12 text-center space-y-3">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto border border-emerald-500/20">
                                <AlertTriangle className="w-8 h-8 text-emerald-500" />
                            </div>
                            <p className="font-medium text-muted-foreground">Tidak ada peminjaman terlambat 🎉</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kode</TableHead>
                                    <TableHead>Peminjam</TableHead>
                                    <TableHead>Jml Item</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Jatuh Tempo</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loans.map((loan) => (
                                    <TableRow key={loan.id}>
                                        <TableCell>
                                            <Link href={`/admin/loans/${loan.id}`} className="font-mono font-bold text-xs text-primary hover:underline bg-primary/5 px-2 py-1 rounded-md border border-primary/10 tracking-tighter">
                                                {loan.loan_code}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <div className="py-0.5">
                                                <p className="text-sm font-bold tracking-tight">{(loan.user as Profile)?.name}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{(loan.user as Profile)?.department}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="secondary" className="font-bold">{(loan as unknown as { loan_items?: { id: number }[] }).loan_items?.length || 0}</Badge></TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS.overdue}`}>
                                                TERLAMBAT
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm font-bold text-red-500">{loan.due_date ? formatDateTime(loan.due_date) : '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 transition-colors" asChild title="Detail Peminjaman">
                                                <Link href={`/admin/loans/${loan.id}`}>
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
