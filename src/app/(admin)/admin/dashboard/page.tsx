'use client'

import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_COLORS, formatDateTime, ACTION_LABELS } from '@/lib/utils'
import Link from 'next/link'
import {
    Package, Users, ClipboardList, AlertTriangle,
    TrendingUp, Wrench, ShoppingCart, Clock
} from 'lucide-react'
import { PendingUserApproveButton } from '@/components/admin/pending-user-approve-button'
import useSWR, { mutate } from 'swr'
import { useAuth } from '@/hooks/use-auth'
import { CardSkeleton } from '@/components/skeletons'

export default function AdminDashboard() {
    const { user } = useAuth()
    const supabase = createClient()

    // 1. Fetch Stats
    const { data: stats, isLoading: statsLoading } = useSWR(user ? ['admin-dashboard-stats'] : null, async () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayISO = today.toISOString()
        const now = new Date()

        const [
            { count: todayLoans },
            { count: activeLoans },
            { data: allOverdueCandidateLoans },
            { count: pendingUsersCount },
            { count: totalItems },
            { count: borrowedItems },
            { count: problemItems },
        ] = await Promise.all([
            supabase.from('loans').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
            supabase.from('loans').select('*', { count: 'exact', head: true }).in('status', ['borrowed', 'partial_return', 'approved']),
            supabase.from('loans').select('id, status, due_date').in('status', ['overdue', 'borrowed', 'partial_return']),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', false),
            supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'borrowed'),
            supabase.from('items').select('*', { count: 'exact', head: true }).in('status', ['maintenance', 'lost']),
        ])

        const overdueCount = allOverdueCandidateLoans?.filter((l: any) => 
            l.status === 'overdue' || (l.due_date && new Date(l.due_date) < now)
        ).length || 0

        return {
            todayLoans: todayLoans || 0,
            activeLoans: activeLoans || 0,
            overdueCount,
            pendingUsersCount: pendingUsersCount || 0,
            totalItems: totalItems || 0,
            borrowedItems: borrowedItems || 0,
            problemItems: problemItems || 0,
        }
    })

    // 2. Fetch Recent Activity
    const { data: recentLogs, isLoading: logsLoading } = useSWR(user ? ['admin-dashboard-logs'] : null, async () => {
        const { data } = await supabase
            .from('audit_logs')
            .select('*, user:profiles(name)')
            .order('created_at', { ascending: false })
            .limit(10)
        return data || []
    })

    // 3. Fetch Active Loans (List) - Added Hint Here
    const { data: activeLoansData, isLoading: loansLoading } = useSWR(user ? ['admin-dashboard-active-loans'] : null, async () => {
        const { data } = await supabase
            .from('loans')
            .select('*, user:profiles!loans_user_id_fkey(name, department)')
            .in('status', ['borrowed', 'partial_return', 'overdue', 'approved'])
            .order('created_at', { ascending: false })
            .limit(10)
        return data || []
    })

    // 4. Fetch Pending Users (List)
    const { data: pendingUsersData, isLoading: pendingLoading } = useSWR(user ? ['admin-dashboard-pending-users'] : null, async () => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('is_approved', false)
            .order('created_at', { ascending: false })
        return data || []
    })

    if (!user) return null

    const statCards = [
        { label: 'Peminjaman Hari Ini', value: stats?.todayLoans ?? 0, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Peminjaman Aktif', value: stats?.activeLoans ?? 0, icon: ClipboardList, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        { label: 'Terlambat', value: stats?.overdueCount ?? 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', badge: true },
        { label: 'Tamu Menunggu', value: stats?.pendingUsersCount ?? 0, icon: Users, color: 'text-yellow-400', bg: 'bg-yellow-500/10', badge: true },
    ]

    const itemStats = [
        { label: 'Total Barang', value: stats?.totalItems ?? 0, icon: Package, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Bermasalah', value: stats?.problemItems ?? 0, icon: Wrench, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Dipinjam', value: stats?.borrowedItems ?? 0, icon: ShoppingCart, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Dashboard Admin</h1>
                <p className="text-muted-foreground">Ringkasan aktivitas laboratorium</p>
            </div>

            {/* Loan Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statsLoading ? Array(4).fill(0).map((_, i) => <Card key={i}><CardContent className="h-24" /></Card>) : 
                statCards.map((stat) => (
                    <Card key={stat.label} className="backdrop-blur-xl bg-card/80 border-border/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-2xl font-bold">{stat.value}</p>
                                        {stat.badge && stat.value > 0 && (
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Item Stats */}
            <div className="grid grid-cols-3 gap-4">
                {statsLoading ? Array(3).fill(0).map((_, i) => <Card key={i}><CardContent className="h-20" /></Card>) :
                itemStats.map((stat) => (
                    <Card key={stat.label} className="backdrop-blur-xl bg-card/80 border-border/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-xl font-bold">{stat.value}</p>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardHeader>
                        <CardTitle className="text-base">Aktivitas Terkini</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {logsLoading ? <CardSkeleton /> : (
                                <>
                                    {recentLogs?.map((log: any) => (
                                        <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                                            <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                                                {ACTION_LABELS[log.action] || log.action}
                                            </Badge>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm truncate">{log.description || '-'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {(log.user as any)?.name || 'Sistem'} • {formatDateTime(log.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!recentLogs || recentLogs.length === 0) && (
                                        <p className="text-muted-foreground text-center py-4">Belum ada aktivitas</p>
                                    )}
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Active Loans */}
                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Peminjaman Aktif</CardTitle>
                            <Link href="/admin/loans" className="text-xs text-primary hover:underline">
                                Lihat Semua →
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {loansLoading ? <CardSkeleton /> : (
                                <>
                                    {activeLoansData?.map((loan: any) => (
                                        <Link
                                            key={loan.id}
                                            href={`/admin/loans/${loan.id}`}
                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs font-mono">{loan.loan_code}</code>
                                                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[loan.status]}`}>
                                                        {STATUS_LABELS[loan.status]}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                    {(loan.user as any)?.name} - {(loan.user as any)?.department}
                                                </p>
                                            </div>
                                            <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
                                        </Link>
                                    ))}
                                    {(!activeLoansData || activeLoansData.length === 0) && (
                                        <p className="text-muted-foreground text-center py-4">Tidak ada peminjaman aktif</p>
                                    )}
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Users */}
            {(pendingLoading || (pendingUsersData && pendingUsersData.length > 0)) && (
                <Card className="backdrop-blur-xl bg-card/80 border-yellow-500/30 shadow-lg shadow-yellow-500/5">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="w-5 h-5 text-yellow-400" />
                            Tamu Menunggu Persetujuan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {pendingLoading ? <CardSkeleton lines={3} /> : pendingUsersData?.map((u: any) => (
                                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                                    <div>
                                        <p className="text-sm font-semibold">{u.name}</p>
                                        <p className="text-xs text-muted-foreground">{u.description} - {u.department}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <PendingUserApproveButton 
                                            userId={u.id} 
                                            onApprove={() => {
                                                mutate(['admin-dashboard-pending-users'])
                                                mutate(['admin-dashboard-stats'])
                                            }} 
                                        />
                                        <Link href="/admin/users">
                                            <Badge variant="outline" className="cursor-pointer hover:bg-primary/20 transition-colors">
                                                Detail
                                            </Badge>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
