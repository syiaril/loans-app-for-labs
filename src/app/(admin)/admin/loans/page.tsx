'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABELS, STATUS_COLORS, formatDate } from '@/lib/utils'
import { Search, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Loan, Profile } from '@/lib/types/database'

export default function LoansPage() {
    const [loans, setLoans] = useState<(Loan & { user?: Profile })[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [page, setPage] = useState(0)
    const perPage = 20

    useEffect(() => { loadLoans() }, [page])

    async function loadLoans() {
        setLoading(true)
        const supabase = createClient()
        let query = supabase.from('loans').select('*, user:profiles(name, department), loan_items(id)', { count: 'exact' })
        if (statusFilter !== 'all') query = query.eq('status', statusFilter)
        if (search) query = query.or(`loan_code.ilike.%${search}%`)
        const { data } = await query.order('created_at', { ascending: false }).range(page * perPage, (page + 1) * perPage - 1)
        setLoans(data || [])
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Manajemen Peminjaman</h1>
                <p className="text-muted-foreground">Kelola semua peminjaman barang</p>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Cari kode pinjam..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadLoans()} className="pl-10" />
                        </div>
                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setTimeout(loadLoans, 0) }}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
                                        <TableHead>Kode Pinjam</TableHead>
                                        <TableHead>Peminjam</TableHead>
                                        <TableHead>Jumlah Item</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Tgl Pinjam</TableHead>
                                        <TableHead>Jatuh Tempo</TableHead>
                                        <TableHead>Tgl Kembali</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loans.map((loan) => (
                                        <TableRow key={loan.id}>
                                            <TableCell>
                                                <Link href={`/admin/loans/${loan.id}`} className="font-mono text-sm text-primary hover:underline">
                                                    {loan.loan_code}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-sm font-medium">{(loan.user as Profile)?.name}</p>
                                                    <p className="text-xs text-muted-foreground">{(loan.user as Profile)?.department}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="secondary">{(loan as Loan & { loan_items?: { id: number }[] }).loan_items?.length || 0}</Badge></TableCell>
                                            <TableCell><Badge variant="outline" className={`text-xs ${STATUS_COLORS[loan.status]}`}>{STATUS_LABELS[loan.status]}</Badge></TableCell>
                                            <TableCell className="text-sm">{loan.borrowed_at ? formatDate(loan.borrowed_at) : '-'}</TableCell>
                                            <TableCell className="text-sm">{loan.due_date ? formatDate(loan.due_date) : '-'}</TableCell>
                                            <TableCell className="text-sm">{loan.returned_at ? formatDate(loan.returned_at) : '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {loans.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada peminjaman ditemukan</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    <div className="flex items-center justify-between mt-4">
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button>
                        <span className="text-sm text-muted-foreground">Halaman {page + 1}</span>
                        <Button variant="outline" size="sm" disabled={loans.length < perPage} onClick={() => setPage(p => p + 1)}>Selanjutnya</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
