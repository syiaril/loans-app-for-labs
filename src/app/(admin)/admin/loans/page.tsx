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
import DataPagination from '@/components/data-pagination'
import { TableSkeleton } from '@/components/skeletons'
import type { Loan, Profile } from '@/lib/types/database'

export default function LoansPage() {
    const [loans, setLoans] = useState<(Loan & { user?: Profile })[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('') // Internal state for search input
    const [statusFilter, setStatusFilter] = useState('all')
    const [page, setPage] = useState(0)
    const [totalItems, setTotalItems] = useState(0)
    const [mounted, setMounted] = useState(false)
    const perPage = 20

    const supabase = createClient()

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        let isMounted = true

        async function loadLoans() {
            setLoading(true)
            let query = supabase.from('loans').select('*, user:profiles(name, department), loan_items(id)', { count: 'exact' })
            if (statusFilter !== 'all') query = query.eq('status', statusFilter)
            if (search) query = query.or(`loan_code.ilike.%${search}%`)
            
            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(page * perPage, (page + 1) * perPage - 1)
            
            if (!isMounted) return

            if (data && !error) {
                setLoans(data)
                if (count !== null) setTotalItems(count)
            }
            setLoading(false)
        }

        loadLoans()
        return () => { isMounted = false }
    }, [page, statusFilter, search])

    // Reset page when filter/search changes
    useEffect(() => {
        setPage(0)
    }, [statusFilter, search])

    const handleSearch = () => {
        setSearch(searchInput)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Manajemen Peminjaman</h1>
                <p className="text-muted-foreground">Kelola semua peminjaman barang</p>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader className="pb-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input 
                                        placeholder="Cari kode pinjam..." 
                                        value={searchInput} 
                                        onChange={(e) => setSearchInput(e.target.value)} 
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
                                        className="h-10 pl-10 rounded-lg text-sm bg-card/50 border-border/60" 
                                    />
                                </div>
                                <Button 
                                    variant="secondary" 
                                    onClick={handleSearch} 
                                    className="h-10 px-4 rounded-lg font-bold active:scale-95 transition-all shrink-0"
                                >
                                    CARI
                                </Button>
                            </div>
                        </div>
                        {mounted && (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-9 rounded-md flex-1 sm:max-w-[200px]"><SelectValue placeholder="Status Peminjaman" /></SelectTrigger>
                                <SelectContent className="rounded-lg">
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
                                </SelectContent>
                            </Select>
                          </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
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
                                <TableSkeleton columns={7} rows={8} />
                            </Table>
                        </div>
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
                                                <Link href={`/admin/loans/${loan.id}`} className="font-mono font-black text-[11px] text-primary hover:underline bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                                                    {loan.loan_code}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <div className="py-0.5">
                                                    <p className="text-xs font-bold tracking-tight">{(loan.user as Profile)?.name}</p>
                                                    <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{(loan.user as Profile)?.department}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="secondary" className="font-bold text-[10px]">{(loan as Loan & { loan_items?: { id: number }[] }).loan_items?.length || 0} ITEM</Badge></TableCell>
                                            <TableCell><Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${STATUS_COLORS[loan.status]}`}>{STATUS_LABELS[loan.status]}</Badge></TableCell>
                                            <TableCell className="text-xs font-medium">{loan.borrowed_at ? formatDate(loan.borrowed_at) : '-'}</TableCell>
                                            <TableCell className="text-xs font-medium">{loan.due_date ? formatDate(loan.due_date) : '-'}</TableCell>
                                            <TableCell className="text-xs font-medium">{loan.returned_at ? formatDate(loan.returned_at) : '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {loans.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada peminjaman ditemukan</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    <DataPagination page={page} perPage={perPage} totalItems={totalItems} currentCount={loans.length} onPageChange={setPage} />
                </CardContent>
            </Card>
        </div>
    )
}
