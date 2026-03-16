'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { Plus, Search, Check, CheckCircle, Pencil, Trash2, Loader2, Printer, User } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import Link from 'next/link'
import DataPagination from '@/components/data-pagination'
import { TableSkeleton } from '@/components/skeletons'
import type { Profile } from '@/lib/types/database'

export default function UsersPage() {
    const { profile: currentUser } = useAuth()
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [approvalFilter, setApprovalFilter] = useState('all')
    const [page, setPage] = useState(0)
    const [mounted, setMounted] = useState(false)
    const perPage = 10

    const supabase = createClient()

    useEffect(() => {
        setMounted(true)
    }, [])

    // 1. Build SWR key for users based on filters
    const usersKey = useMemo(() => {
        return ['users', page, roleFilter, approvalFilter, search]
    }, [page, roleFilter, approvalFilter, search])

    // 2. Fetch users with SWR
    const { data: usersData, error: usersError, isLoading: usersLoading } = useSWR(usersKey, async () => {
        let query = supabase.from('profiles').select('*', { count: 'exact' })
        if (roleFilter !== 'all') query = query.eq('role', roleFilter)
        if (approvalFilter === 'approved') query = query.eq('is_approved', true)
        if (approvalFilter === 'pending') query = query.eq('is_approved', false)
        if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,card_barcode.ilike.%${search}%,department.ilike.%${search}%`)
        
        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(page * perPage, (page + 1) * perPage - 1)
        
        if (error) throw error
        return { users: data || [], total: count || 0 }
    }, {
        keepPreviousData: true,
        revalidateOnFocus: false
    })

    const users = usersData?.users || []
    const totalItems = usersData?.total || 0
    const loading = usersLoading && !usersData

    // Reset pagination when filters change
    useEffect(() => {
        setPage(0)
    }, [roleFilter, approvalFilter, search])

    async function approveUser(userId: string) {
        await supabase.from('profiles').update({ is_approved: true }).eq('id', userId)
        await supabase.from('audit_logs').insert({
            user_id: currentUser?.id,
            action: 'approve',
            model_type: 'profile',
            description: `Menyetujui pengguna`,
        })
        toast.success('Pengguna disetujui')
        
        // Mutate SWR
        mutate(usersKey)
    }

    async function deleteUser(userId: string) {
        if (userId === currentUser?.id) {
            toast.error('Tidak bisa menghapus diri sendiri')
            return
        }
        // Check active loans
        const { count } = await supabase.from('loans').select('*', { count: 'exact', head: true })
            .eq('user_id', userId).in('status', ['borrowed', 'partial_return', 'overdue'])
        if (count && count > 0) {
            toast.error('Tidak bisa menghapus pengguna dengan peminjaman aktif')
            return
        }
        await supabase.from('profiles').delete().eq('id', userId)
        await supabase.from('audit_logs').insert({
            user_id: currentUser?.id,
            action: 'delete',
            model_type: 'profile',
            description: `Menghapus pengguna`,
        })
        toast.success('Pengguna dihapus')
        
        // Mutate SWR
        mutate(usersKey)
    }

    const handleSearch = () => {
        setSearch(searchInput)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Manajemen Pengguna</h1>
                    <p className="text-muted-foreground">Kelola semua pengguna sistem</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/admin/users/cards">
                        <Button variant="outline">
                            <Printer className="w-4 h-4 mr-2" />
                            Cetak Kartu
                        </Button>
                    </Link>
                    <Link href="/admin/users/create">
                        <Button><Plus className="w-4 h-4 mr-2" />Tambah</Button>
                    </Link>
                </div>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Cari nama, email, barcode..." 
                                    value={searchInput} 
                                    onChange={(e) => setSearchInput(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
                                    className="pl-10" 
                                />
                            </div>
                            <Button variant="secondary" onClick={handleSearch} className="px-3 shrink-0">Cari</Button>
                        </div>
                        {mounted && (
                          <>
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="w-[140px] shrink-0"><SelectValue placeholder="Role" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Role</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="borrower">Peminjam</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                                <SelectTrigger className="w-[150px] shrink-0"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    <SelectItem value="approved">Disetujui</SelectItem>
                                    <SelectItem value="pending">Menunggu</SelectItem>
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
                                        <TableHead className="w-14">Foto</TableHead>
                                        <TableHead>Nama</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Departemen</TableHead>
                                        <TableHead>Barcode</TableHead>
                                        <TableHead>Status</TableHead>
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
                                        <TableHead className="w-14">Foto</TableHead>
                                        <TableHead>Nama</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Departemen</TableHead>
                                        <TableHead>Barcode</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((u: Profile) => (
                                        <TableRow key={u.id}>
                                            <TableCell>
                                                {u.photo ? (
                                                    <img 
                                                        src={supabase.storage.from('profiles').getPublicUrl(u.photo).data.publicUrl} 
                                                        alt={u.name} 
                                                        className="w-10 h-10 rounded-full object-cover border border-border"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-border/50">
                                                        <User className="w-5 h-5 text-primary/60" />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{u.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{u.email || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                                                    {u.role === 'admin' ? 'Admin' : 'Peminjam'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">{u.department || '-'}</TableCell>
                                            <TableCell><code className="text-xs">{u.card_barcode || '-'}</code></TableCell>
                                            <TableCell>
                                                {u.is_approved ? (
                                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400">Aktif</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400">Menunggu</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {!u.is_approved && (
                                                        <Button variant="outline" size="sm" onClick={() => approveUser(u.id)} className="h-8 border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium mr-1 transition-colors">
                                                            <CheckCircle className="w-4 h-4 mr-1.5" />
                                                            Setujui
                                                        </Button>
                                                    )}
                                                    <Link href={`/admin/users/${u.id}/edit`}>
                                                        <Button variant="ghost" size="icon"><Pencil className="w-4 h-4" /></Button>
                                                    </Link>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
                                                                <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => deleteUser(u.id)}>Hapus</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {users.length === 0 && (
                                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada pengguna ditemukan</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    <DataPagination page={page} perPage={perPage} totalItems={totalItems} currentCount={users.length} onPageChange={setPage} />
                </CardContent>
            </Card>
        </div>
    )
}
