'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABELS, STATUS_COLORS, formatDateTime } from '@/lib/utils'
import { Search, Loader2, Eye } from 'lucide-react'
import Link from 'next/link'
import DataPagination from '@/components/data-pagination'
import { TableSkeleton } from '@/components/skeletons'
import type { Loan, Profile } from '@/lib/types/database'

export default function LoansPage() {
    const perPage = 10
    const [page, setPage] = useState(0)
    const [statusFilter, setStatusFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [mounted, setMounted] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        setMounted(true)
    }, [])

    // 1. Build SWR key for loans
    const loansKey = useMemo(() => {
        return ['loans', page, statusFilter, search]
    }, [page, statusFilter, search])

    // 2. Fetch loans with SWR
    const { data: loansData, error: loansError, isLoading: loansLoading } = useSWR(loansKey, async () => {
        const now = new Date().toISOString()
        
        let query = supabase
            .from('loans')
            .select('*, user:profiles!loans_user_id_fkey(name, department), loan_items(id)', { count: 'exact' })
        
        if (statusFilter !== 'all') {
            if (statusFilter === 'overdue') {
                query = query.or(`status.eq.overdue,and(status.eq.borrowed,due_date.lt.${now}),and(status.eq.partial_return,due_date.lt.${now})`)
            } else {
                query = query.eq('status', statusFilter)
            }
        }

        if (search) {
            query = query.ilike('loan_code', `%${search}%`)
        }
        
        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(page * perPage, (page + 1) * perPage - 1)

        if (error) throw error
        return { loans: data || [], total: count || 0 }
    }, {
        keepPreviousData: true,
        revalidateOnFocus: false
    })

    const loans = (loansData?.loans || []) as (Loan & { user?: Profile })[]
    const totalItems = loansData?.total || 0
    const loading = loansLoading && !loansData

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
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Cari kode pinjam..." 
                                    value={searchInput} 
                                    onChange={(e) => setSearchInput(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
                                    className="pl-10" 
                                />
                            </div>
                            <Button variant="secondary" onClick={handleSearch} className="px-3 shrink-0">Cari</Button>
                        </div>
                        {mounted && (
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                              <SelectTrigger className="w-[180px] shrink-0"><SelectValue placeholder="Status" /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">Semua Status</SelectItem>
                                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
                              </SelectContent>
                          </Select>
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
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableSkeleton columns={8} rows={8} />
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
                                        <TableHead className="text-right">Aksi</TableHead>
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
                                                    <p className="text-xs font-bold tracking-tight">{(loan.user as Profile)?.name || '-'}</p>
                                                    <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{(loan.user as Profile)?.department || '-'}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="secondary" className="font-bold text-[10px]">{loan.loan_items?.length || 0} ITEM</Badge></TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const isActuallyOverdue = loan.status === 'overdue' || (['borrowed', 'partial_return'].includes(loan.status) && loan.due_date && new Date(loan.due_date) < new Date());
                                                    return (
                                                        <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${isActuallyOverdue ? STATUS_COLORS.overdue : STATUS_COLORS[loan.status]}`}>
                                                            {isActuallyOverdue ? STATUS_LABELS.overdue : STATUS_LABELS[loan.status]}
                                                        </Badge>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">{loan.borrowed_at ? formatDateTime(loan.borrowed_at) : '-'}</TableCell>
                                            <TableCell className="text-xs font-medium">{loan.due_date ? formatDateTime(loan.due_date) : '-'}</TableCell>
                                            <TableCell className="text-xs font-medium">{loan.returned_at ? formatDateTime(loan.returned_at) : '-'}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 transition-colors" asChild title="Detail Peminjaman">
                                                    <Link href={`/admin/loans/${loan.id}`}>
                                                        <Eye className="w-4 h-4" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {loans.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada peminjaman ditemukan</TableCell></TableRow>}
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
