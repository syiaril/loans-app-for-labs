'use client'

import { useState, useEffect } from 'react'
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
    const [items, setItems] = useState<(Item & { category?: Category })[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [catFilter, setCatFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [page, setPage] = useState(0)
    const perPage = 20

    useEffect(() => { loadData() }, [page])

    async function loadData() {
        setLoading(true)
        const supabase = createClient()
        const { data: cats } = await supabase.from('categories').select('*').eq('is_active', true)
        setCategories(cats || [])

        let query = supabase.from('items').select('*, category:categories(name)', { count: 'exact' })
        if (catFilter !== 'all') query = query.eq('category_id', catFilter)
        if (statusFilter !== 'all') query = query.eq('status', statusFilter)
        if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,barcode.ilike.%${search}%`)
        const { data } = await query.order('created_at', { ascending: false }).range(page * perPage, (page + 1) * perPage - 1)
        setItems(data || [])
        setLoading(false)
    }

    async function deleteItem(item: Item) {
        if (item.status === 'borrowed') {
            toast.error('Tidak bisa menghapus barang yang sedang dipinjam')
            return
        }
        const supabase = createClient()
        await supabase.from('items').delete().eq('id', item.id)
        if (item.image) {
            await supabase.storage.from('items').remove([item.image])
        }
        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'delete', model_type: 'item', model_id: item.id, description: `Menghapus barang: ${item.name}` })
        toast.success('Barang dihapus')
        loadData()
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Manajemen Barang</h1>
                    <p className="text-muted-foreground">Kelola inventaris laboratorium</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/admin/items/barcodes"><Button variant="outline"><Printer className="w-4 h-4 mr-2" />Cetak Barcode</Button></Link>
                    <Link href="/admin/items/create"><Button><Plus className="w-4 h-4 mr-2" />Tambah Barang</Button></Link>
                </div>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Cari nama, kode, barcode..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadData()} className="pl-10" />
                        </div>
                        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setTimeout(loadData, 0) }}>
                            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setTimeout(loadData, 0) }}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                {Object.entries(ITEM_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                        </Select>
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
                                    {items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                                        <Package className="w-4 h-4 text-muted-foreground" />
                                                    </div>
                                                    <span className="font-medium text-sm">{item.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell><code className="text-xs">{item.code}</code></TableCell>
                                            <TableCell><code className="text-xs">{item.barcode}</code></TableCell>
                                            <TableCell className="text-sm">{item.category?.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-xs ${ITEM_STATUS_COLORS[item.status]}`}>
                                                    {ITEM_STATUS_LABELS[item.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">{CONDITION_LABELS[item.condition] || item.condition}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link href={`/admin/items/${item.id}`}><Button variant="ghost" size="icon"><Package className="w-4 h-4" /></Button></Link>
                                                    <Link href={`/admin/items/${item.id}/edit`}><Button variant="ghost" size="icon"><Pencil className="w-4 h-4" /></Button></Link>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Hapus Barang?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => deleteItem(item)}>Hapus</AlertDialogAction></AlertDialogFooter>
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
                    <DataPagination page={page} perPage={perPage} currentCount={items.length} onPageChange={setPage} />
                </CardContent>
            </Card>
        </div>
    )
}
