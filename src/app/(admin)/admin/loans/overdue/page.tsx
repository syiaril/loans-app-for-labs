'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { STATUS_LABELS, STATUS_COLORS, formatDate } from '@/lib/utils'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Loan, Profile } from '@/lib/types/database'

export default function OverdueLoansPage() {
    const { profile: currentUser } = useAuth()
    const [loans, setLoans] = useState<(Loan & { user?: Profile })[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadOverdue() }, [])

    async function loadOverdue() {
        const supabase = createClient()
        // First, mark overdue loans
        const today = new Date().toISOString().split('T')[0]
        await supabase.from('loans').update({ status: 'overdue' })
            .in('status', ['borrowed', 'partial_return'])
            .lt('due_date', today)

        const { data } = await supabase.from('loans')
            .select('*, user:profiles(name, department), loan_items(id)')
            .eq('status', 'overdue')
            .order('due_date', { ascending: true })
        setLoans(data || [])
        setLoading(false)
    }

    async function markAllOverdue() {
        const supabase = createClient()
        const today = new Date().toISOString().split('T')[0]
        const { count } = await supabase.from('loans').update({ status: 'overdue' })
            .in('status', ['borrowed', 'partial_return']).lt('due_date', today)
        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'update', model_type: 'loan', description: `Menandai ${count || 0} peminjaman terlambat` })
        toast.success(`${count || 0} peminjaman ditandai terlambat`)
        loadOverdue()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6 text-red-400" />Peminjaman Terlambat
                    </h1>
                    <p className="text-muted-foreground">Daftar peminjaman yang melewati jatuh tempo</p>
                </div>
                <Button variant="destructive" onClick={markAllOverdue}>Tandai Semua Terlambat</Button>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : loans.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">Tidak ada peminjaman terlambat 🎉</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kode</TableHead>
                                    <TableHead>Peminjam</TableHead>
                                    <TableHead>Jml Item</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Jatuh Tempo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loans.map((loan) => (
                                    <TableRow key={loan.id}>
                                        <TableCell>
                                            <Link href={`/admin/loans/${loan.id}`} className="font-mono text-sm text-primary hover:underline">{loan.loan_code}</Link>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-sm font-medium">{(loan.user as Profile)?.name}</p>
                                            <p className="text-xs text-muted-foreground">{(loan.user as Profile)?.department}</p>
                                        </TableCell>
                                        <TableCell><Badge variant="secondary">{(loan as unknown as { loan_items?: { id: number }[] }).loan_items?.length || 0}</Badge></TableCell>
                                        <TableCell><Badge variant="outline" className={`text-xs ${STATUS_COLORS[loan.status]}`}>{STATUS_LABELS[loan.status]}</Badge></TableCell>
                                        <TableCell className="text-sm text-red-400">{loan.due_date ? formatDate(loan.due_date) : '-'}</TableCell>
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
