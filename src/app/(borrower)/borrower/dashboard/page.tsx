'use client'

import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_COLORS, formatDateTime } from '@/lib/utils'
import { Package, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import CountdownTimer from '@/components/loans/countdown-timer'
import { useAuth } from '@/hooks/use-auth'
import useSWR from 'swr'
import { CardSkeleton } from '@/components/skeletons'

export default function BorrowerDashboard() {
    const { user, profile } = useAuth()
    const supabase = createClient()

    // 1. Fetch active loans with SWR
    const { data: activeLoans = [], isLoading: activeLoading } = useSWR(user ? ['activeLoans', user.id] : null, async () => {
        const { data } = await supabase
            .from('loans')
            .select(`*, loan_items(*, item:items(name, code))`)
            .eq('user_id', user!.id)
            .in('status', ['pending', 'approved', 'borrowed', 'partial_return', 'overdue'])
            .order('created_at', { ascending: false })
        return data || []
    })

    // 2. Fetch recent loans with SWR
    const { data: recentLoans = [], isLoading: recentLoading } = useSWR(user ? ['recentLoans', user.id] : null, async () => {
        const { data } = await supabase
            .from('loans')
            .select(`*, loan_items(*, item:items(name, code))`)
            .eq('user_id', user!.id)
            .in('status', ['returned', 'cancelled'])
            .order('created_at', { ascending: false })
            .limit(10)
        return data || []
    })

    if (!user) return null
    if (!profile) return <div className="p-8 text-center">Loading profile...</div>

    const totalActive = activeLoans.length
    const totalItems = activeLoans.reduce((acc, l) => acc + (l.loan_items?.length || 0), 0)
    const now = new Date()
    const overdueCount = activeLoans.filter(l => 
        l.status === 'overdue' || 
        (['borrowed', 'partial_return'].includes(l.status) && l.due_date && new Date(l.due_date) < now)
    ).length

    if (activeLoading && recentLoading && activeLoans.length === 0) {
        return <div className="space-y-6"><CardSkeleton /></div>
    }

    return (
        <div className="space-y-6">
            {/* Welcome */}
            <div>
                <h1 className="text-2xl font-bold">Halo, {profile?.name}! 👋</h1>
                <p className="text-muted-foreground">Selamat datang di Sistem Peminjaman Barang Lab</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <Package className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{totalActive}</p>
                                <p className="text-sm text-muted-foreground">Peminjaman Aktif</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{totalItems}</p>
                                <p className="text-sm text-muted-foreground">Barang Dipinjam</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${overdueCount > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                                {overdueCount > 0 ? (
                                    <AlertTriangle className="w-6 h-6 text-red-400" />
                                ) : (
                                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                                )}
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{overdueCount}</p>
                                <p className="text-sm text-muted-foreground">Terlambat</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Active Loans */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg">Peminjaman Aktif</CardTitle>
                </CardHeader>
                <CardContent>
                    {(!activeLoans || activeLoans.length === 0) ? (
                        <p className="text-muted-foreground text-center py-8">Tidak ada peminjaman aktif</p>
                    ) : (
                        <div className="space-y-3">
                            {activeLoans.map((loan) => (
                                <div key={loan.id} className="p-4 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{loan.loan_code}</code>
                                            <Badge variant="outline" className={STATUS_COLORS[loan.status]}>
                                                {STATUS_LABELS[loan.status]}
                                            </Badge>
                                        </div>
                                        {loan.due_date && (
                                            <CountdownTimer dueDate={loan.due_date} status={loan.status} />
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {loan.loan_items?.map((li: { id: number; item?: { name: string; code: string }; returned_at: string | null }) => (
                                            <Badge key={li.id} variant="secondary" className="text-xs">
                                                {li.item?.name} {li.returned_at ? '✓' : ''}
                                            </Badge>
                                        ))}
                                    </div>
                                    {loan.borrowed_at && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Dipinjam: {formatDateTime(loan.borrowed_at)}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent History */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg">Riwayat Terbaru</CardTitle>
                </CardHeader>
                <CardContent>
                    {(!recentLoans || recentLoans.length === 0) ? (
                        <p className="text-muted-foreground text-center py-8">Belum ada riwayat</p>
                    ) : (
                        <div className="space-y-2">
                            {recentLoans.map((loan) => (
                                <div key={loan.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs font-mono">{loan.loan_code}</code>
                                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[loan.status]}`}>
                                            {STATUS_LABELS[loan.status]}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{formatDateTime(loan.created_at)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
