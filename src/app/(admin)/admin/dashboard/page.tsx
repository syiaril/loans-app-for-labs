import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_COLORS, formatDateTime, ACTION_LABELS } from '@/lib/utils'
import Link from 'next/link'
import {
    Package, Users, ClipboardList, AlertTriangle,
    TrendingUp, Wrench, ShoppingCart, Clock
} from 'lucide-react'

export default async function AdminDashboard() {
    const supabase = await createClient()

    // Today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // Stats queries
    const [
        { count: todayLoans },
        { count: activeLoans },
        { count: overdueLoans },
        { count: pendingUsers },
        { count: totalItems },
        { count: borrowedItems },
        { count: problemItems },
    ] = await Promise.all([
        supabase.from('loans').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
        supabase.from('loans').select('*', { count: 'exact', head: true }).in('status', ['borrowed', 'partial_return', 'approved']),
        supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', false),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'borrowed'),
        supabase.from('items').select('*', { count: 'exact', head: true }).in('status', ['maintenance', 'lost']),
    ])

    // Recent audit logs
    const { data: recentLogs } = await supabase
        .from('audit_logs')
        .select('*, user:profiles(name)')
        .order('created_at', { ascending: false })
        .limit(10)

    // Active loans
    const { data: activeLoansData } = await supabase
        .from('loans')
        .select('*, user:profiles(name, department)')
        .in('status', ['borrowed', 'partial_return', 'overdue', 'approved'])
        .order('created_at', { ascending: false })
        .limit(10)

    // Pending users
    const { data: pendingUsersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false })

    const statCards = [
        { label: 'Peminjaman Hari Ini', value: todayLoans ?? 0, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Peminjaman Aktif', value: activeLoans ?? 0, icon: ClipboardList, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        { label: 'Terlambat', value: overdueLoans ?? 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', badge: true },
        { label: 'Tamu Menunggu', value: pendingUsers ?? 0, icon: Users, color: 'text-yellow-400', bg: 'bg-yellow-500/10', badge: true },
    ]

    const itemStats = [
        { label: 'Total Barang', value: totalItems ?? 0, icon: Package, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Bermasalah', value: problemItems ?? 0, icon: Wrench, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Dipinjam', value: borrowedItems ?? 0, icon: ShoppingCart, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Dashboard Admin</h1>
                <p className="text-muted-foreground">Ringkasan aktivitas laboratorium</p>
            </div>

            {/* Loan Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat) => (
                    <Card key={stat.label} className="backdrop-blur-xl bg-card/80 border-border/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <div>
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
                {itemStats.map((stat) => (
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
                            {recentLogs?.map((log) => (
                                <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                                    <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                                        {ACTION_LABELS[log.action] || log.action}
                                    </Badge>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm truncate">{log.description || '-'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {(log.user as { name?: string })?.name || 'Sistem'} • {formatDateTime(log.created_at)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {(!recentLogs || recentLogs.length === 0) && (
                                <p className="text-muted-foreground text-center py-4">Belum ada aktivitas</p>
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
                            {activeLoansData?.map((loan) => (
                                <Link
                                    key={loan.id}
                                    href={`/admin/loans/${loan.id}`}
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs font-mono">{loan.loan_code}</code>
                                            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[loan.status]}`}>
                                                {STATUS_LABELS[loan.status]}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {(loan.user as { name?: string; department?: string })?.name} - {(loan.user as { department?: string })?.department}
                                        </p>
                                    </div>
                                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                </Link>
                            ))}
                            {(!activeLoansData || activeLoansData.length === 0) && (
                                <p className="text-muted-foreground text-center py-4">Tidak ada peminjaman aktif</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Users */}
            {pendingUsersData && pendingUsersData.length > 0 && (
                <Card className="backdrop-blur-xl bg-card/80 border-yellow-500/30">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="w-5 h-5 text-yellow-400" />
                            Tamu Menunggu Persetujuan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {pendingUsersData.map((u) => (
                                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                                    <div>
                                        <p className="text-sm font-medium">{u.name}</p>
                                        <p className="text-xs text-muted-foreground">{u.description} - {u.department}</p>
                                    </div>
                                    <Link href="/admin/users">
                                        <Badge variant="outline" className="cursor-pointer hover:bg-primary/10">
                                            Lihat
                                        </Badge>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
