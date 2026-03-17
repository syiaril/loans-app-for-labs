'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { ITEM_STATUS_LABELS, ITEM_STATUS_COLORS, CONDITION_LABELS } from '@/lib/utils'
import { Plus, Search, Pencil, Trash2, Loader2, Package, Printer } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import Link from 'next/link'
import DataPagination from '@/components/data-pagination'
import { TableSkeleton } from '@/components/skeletons'
import type { Item, Category } from '@/lib/types/database'

export default function ItemsPage() {
    const { profile: currentUser } = useAuth()
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [catFilter, setCatFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [page, setPage] = useState(0)
    const [mounted, setMounted] = useState(false)
    const perPage = 10

    const supabase = createClient()

    useEffect(() => {
        setMounted(true)
    }, [])

    // 1. Fetch categories with SWR
    const { data: categories = [] } = useSWR<Category[]>('categories', async () => {
        const { data } = await supabase.from('categories').select('*').eq('is_active', true)
        return (data as Category[]) || []
    })

    // 2. Build SWR key for items based on filters
    const itemsKey = useMemo(() => {
        return ['items', page, catFilter, statusFilter, search]
    }, [page, catFilter, statusFilter, search])

    // 3. Fetch items with SWR
    const { data: itemsData, error: itemsError, isLoading: itemsLoading } = useSWR(itemsKey, async () => {
        let query = supabase.from('items').select('*, category:categories(name)', { count: 'exact' })
        
        if (catFilter !== 'all') query = query.eq('category_id', catFilter)
        if (statusFilter !== 'all') query = query.eq('status', statusFilter)
        if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,barcode.ilike.%${search}%`)
        
        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(page * perPage, (page + 1) * perPage - 1)

        if (error) throw error
        return { items: data || [], total: count || 0 }
    }, {
        keepPreviousData: true, // This makes navigation feel instant
        revalidateOnFocus: false // Reduce noise, focus is enough
    })

    const items = itemsData?.items || []
    const totalItems = itemsData?.total || 0
    const loading = itemsLoading && !itemsData // Only show full loading if no previous data

    // Reset pagination to 0 when filters change
    useEffect(() => {
        setPage(0)
    }, [catFilter, statusFilter, search])

    async function deleteItem(item: Item) {
        if (item.status === 'borrowed') {
            toast.error('Tidak bisa menghapus barang yang sedang dipinjam')
            return
        }
        await supabase.from('items').delete().eq('id', item.id)
        if (item.image) {
            await supabase.storage.from('items').remove([item.image])
        }
        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'delete', model_type: 'item', model_id: item.id, description: `Menghapus barang: ${item.name}` })
        toast.success('Barang dihapus')
        
        // Mutate SWR cache to update UI instantly
        mutate(itemsKey)
    }

    const executeSearch = () => setSearch(searchInput)

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Manajemen Barang</h1>
                    <p className="text-muted-foreground">Kelola inventaris laboratorium</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/admin/items/barcodes"><Button variant="outline"><Printer className="w-4 h-4 mr-2" />Cetak Barcode</Button></Link>
                    <Link href="/admin/items/create"><Button><Plus className="w-4 h-4 mr-2" />Tambah</Button></Link>
                </div>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Cari nama, kode, barcode..." 
                                    value={searchInput} 
                                    onChange={(e) => setSearchInput(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && executeSearch()} 
                                    className="pl-10" 
                                />
                            </div>
                            <Button variant="secondary" onClick={executeSearch} className="px-3 shrink-0">Cari</Button>
                        </div>
                        {mounted && (
                          <>
                            <Select value={catFilter} onValueChange={setCatFilter}>
                                <SelectTrigger className="w-[180px] shrink-0"><SelectValue placeholder="Kategori" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Kategori</SelectItem>
                                    {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[160px] shrink-0"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    {Object.entries(ITEM_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
                                </SelectContent>
                            </Select>
                          </>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Barang</TableHead>
                                        <TableHead>Kode</TableHead>
                                        <TableHead>Barcode</TableHead>
                                        <TableHead>Kategori</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Kondisi</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
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
                                        <TableHead>Barang</TableHead>
                                        <TableHead>Kode</TableHead>
                                        <TableHead>Barcode</TableHead>
                                        <TableHead>Kategori</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Kondisi</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden border border-border/40">
                                                        {item.image ? (
                                                            <img
                                                                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/items/${item.image}`}
                                                                alt={item.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <Package className="w-4 h-4 text-muted-foreground/50" />
                                                        )}
                                                    </div>
                                                    <span className="font-bold text-xs tracking-tight">{item.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell><code className="text-xs font-mono bg-muted/60 px-2 py-0.5 rounded">{item.code}</code></TableCell>
                                            <TableCell><code className="text-xs font-mono bg-muted/60 px-2 py-0.5 rounded">{item.barcode}</code></TableCell>
                                            <TableCell className="text-sm font-medium">{item.category?.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-wider ${ITEM_STATUS_COLORS[item.status]}`}>
                                                    {ITEM_STATUS_LABELS[item.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm font-medium">{CONDITION_LABELS[item.condition] || item.condition}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link href={`/admin/items/${item.id}`}><Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg active:scale-90 transition-all"><Package className="w-4 h-4" /></Button></Link>
                                                    <Link href={`/admin/items/${item.id}/edit`}><Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg active:scale-90 transition-all"><Pencil className="w-4 h-4" /></Button></Link>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent className="rounded-2xl">
                                                            <AlertDialogHeader><AlertDialogTitle>Hapus Barang?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter className="gap-2"><AlertDialogCancel className="h-10 rounded-lg">Batal</AlertDialogCancel><AlertDialogAction onClick={() => deleteItem(item)} className="h-10 rounded-lg bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada barang ditemukan</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    <DataPagination page={page} perPage={perPage} totalItems={totalItems} currentCount={items.length} onPageChange={setPage} />
                </CardContent>
            </Card>
        </div>
    )
}
