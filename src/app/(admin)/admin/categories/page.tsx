'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import type { Category } from '@/lib/types/database'

export default function CategoriesPage() {
    const { profile: currentUser } = useAuth()
    const [categories, setCategories] = useState<(Category & { item_count?: number })[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<Category | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ name: '', description: '', is_active: true })

    useEffect(() => { loadCategories() }, [])

    async function loadCategories() {
        setLoading(true)
        const supabase = createClient()
        const { data } = await supabase.from('categories').select('*').order('name')
        if (data) {
            const withCounts = await Promise.all(data.map(async (cat) => {
                const { count } = await supabase.from('items').select('*', { count: 'exact', head: true }).eq('category_id', cat.id)
                return { ...cat, item_count: count ?? 0 }
            }))
            setCategories(withCounts)
        }
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        setForm({ name: '', description: '', is_active: true })
        setDialogOpen(true)
    }

    function openEdit(cat: Category) {
        setEditing(cat)
        setForm({ name: cat.name, description: cat.description || '', is_active: cat.is_active })
        setDialogOpen(true)
    }

    async function handleSave() {
        setSaving(true)
        const supabase = createClient()

        if (editing) {
            const { error } = await supabase.from('categories').update(form).eq('id', editing.id)
            if (error) { toast.error(error.message); setSaving(false); return }
            await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'update', model_type: 'category', model_id: editing.id, description: `Mengubah kategori: ${form.name}` })
            toast.success('Kategori diperbarui')
        } else {
            const { error } = await supabase.from('categories').insert(form)
            if (error) { toast.error(error.message); setSaving(false); return }
            await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'create', model_type: 'category', description: `Membuat kategori: ${form.name}` })
            toast.success('Kategori ditambahkan')
        }

        setDialogOpen(false)
        setSaving(false)
        loadCategories()
    }

    async function handleDelete(cat: Category & { item_count?: number }) {
        if (cat.item_count && cat.item_count > 0) {
            toast.error('Tidak bisa menghapus kategori yang masih memiliki barang')
            return
        }
        const supabase = createClient()
        await supabase.from('categories').delete().eq('id', cat.id)
        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'delete', model_type: 'category', model_id: cat.id, description: `Menghapus kategori: ${cat.name}` })
        toast.success('Kategori dihapus')
        loadCategories()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Manajemen Kategori</h1>
                    <p className="text-muted-foreground">Kelola kategori barang laboratorium</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Tambah Kategori</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{editing ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Nama *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Deskripsi</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                            <div className="flex items-center justify-between"><Label>Aktif</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
                            <Button onClick={handleSave} disabled={saving || !form.name}>
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Simpan
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>Deskripsi</TableHead>
                                    <TableHead>Jumlah Barang</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((cat) => (
                                    <TableRow key={cat.id}>
                                        <TableCell className="font-medium">{cat.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{cat.description || '-'}</TableCell>
                                        <TableCell><Badge variant="secondary">{cat.item_count}</Badge></TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cat.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}>
                                                {cat.is_active ? 'Aktif' : 'Nonaktif'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Pencil className="w-4 h-4" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Hapus Kategori?</AlertDialogTitle><AlertDialogDescription>Kategori hanya bisa dihapus jika tidak memiliki barang.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(cat)}>Hapus</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {categories.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada kategori</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
