'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Loader2, TrendingUp, Users, Package, Undo2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function MonthlyReportPage() {
    const now = new Date()
    const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ total: 0, items: 0, uniqueUsers: 0, returned: 0, overdue: 0 })
    const [chartData, setChartData] = useState<{ day: string; count: number }[]>([])
    const [popularItems, setPopularItems] = useState<{ name: string; count: number }[]>([])
    const [activeBorrowers, setActiveBorrowers] = useState<{ name: string; count: number }[]>([])

    useEffect(() => { loadData() }, [month])

    async function loadData() {
        setLoading(true)
        const supabase = createClient()
        const [year, mon] = month.split('-').map(Number)
        const startDate = new Date(year, mon - 1, 1).toISOString()
        const endDate = new Date(year, mon, 0, 23, 59, 59).toISOString()

        // Get loans in month
        const { data: loans } = await supabase.from('loans')
            .select('*, user:profiles(name), loan_items(id, item:items(name))')
            .gte('created_at', startDate).lte('created_at', endDate)

        const totalLoans = loans?.length || 0
        const totalItems = loans?.reduce((a, l) => a + ((l.loan_items as { id: number }[])?.length || 0), 0) || 0
        const uniqueUsers = new Set(loans?.map(l => l.user_id)).size
        const returnedCount = loans?.filter(l => l.status === 'returned').length || 0
        const overdueCount = loans?.filter(l => l.status === 'overdue').length || 0

        setStats({ total: totalLoans, items: totalItems, uniqueUsers, returned: returnedCount, overdue: overdueCount })

        // Chart data - loans per day
        const daysInMonth = new Date(year, mon, 0).getDate()
        const dayMap: Record<string, number> = {}
        for (let d = 1; d <= daysInMonth; d++) dayMap[d.toString()] = 0
        loans?.forEach(l => {
            const day = new Date(l.created_at).getDate().toString()
            dayMap[day] = (dayMap[day] || 0) + 1
        })
        setChartData(Object.entries(dayMap).map(([day, count]) => ({ day, count })))

        // Popular items
        const itemCounts: Record<string, number> = {}
        loans?.forEach(l => {
            (l.loan_items as { id: number; item: { name: string } }[])?.forEach(li => {
                const name = li.item?.name || 'Unknown'
                itemCounts[name] = (itemCounts[name] || 0) + 1
            })
        })
        setPopularItems(Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })))

        // Active borrowers
        const borrowerCounts: Record<string, number> = {}
        loans?.forEach(l => {
            const name = (l.user as { name: string })?.name || 'Unknown'
            borrowerCounts[name] = (borrowerCounts[name] || 0) + 1
        })
        setActiveBorrowers(Object.entries(borrowerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })))

        setLoading(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Laporan Bulanan</h1>
                    <p className="text-muted-foreground">Ringkasan aktivitas per bulan</p>
                </div>
                <div className="flex items-center gap-2">
                    <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
                    <Button variant="outline" onClick={() => window.open(`/api/reports/monthly-export?month=${month}`, '_blank')}>
                        <Download className="w-4 h-4 mr-2" />Export CSV
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                            { label: 'Total Peminjaman', value: stats.total, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                            { label: 'Total Item', value: stats.items, icon: Package, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                            { label: 'Peminjam Unik', value: stats.uniqueUsers, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                            { label: 'Dikembalikan', value: stats.returned, icon: Undo2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                            { label: 'Terlambat', value: stats.overdue, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10' },
                        ].map(s => (
                            <Card key={s.label} className="backdrop-blur-xl bg-card/80 border-border/50">
                                <CardContent className="pt-4 pb-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                                            <s.icon className={`w-4 h-4 ${s.color}`} />
                                        </div>
                                        <div><p className="text-lg font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Chart */}
                    <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                        <CardHeader><CardTitle className="text-base">Peminjaman per Hari</CardTitle></CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Peminjaman" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Popular Items */}
                        <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                            <CardHeader><CardTitle className="text-base">Barang Populer (Top 10)</CardTitle></CardHeader>
                            <CardContent>
                                {popularItems.length === 0 ? <p className="text-muted-foreground text-center py-4">Belum ada data</p> : (
                                    <div className="space-y-2">
                                        {popularItems.map((item, i) => (
                                            <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                                                    <span className="text-sm">{item.name}</span>
                                                </div>
                                                <span className="text-sm font-medium">{item.count}x</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Active Borrowers */}
                        <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                            <CardHeader><CardTitle className="text-base">Peminjam Aktif (Top 10)</CardTitle></CardHeader>
                            <CardContent>
                                {activeBorrowers.length === 0 ? <p className="text-muted-foreground text-center py-4">Belum ada data</p> : (
                                    <div className="space-y-2">
                                        {activeBorrowers.map((b, i) => (
                                            <div key={b.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                                                    <span className="text-sm">{b.name}</span>
                                                </div>
                                                <span className="text-sm font-medium">{b.count}x</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    )
}
