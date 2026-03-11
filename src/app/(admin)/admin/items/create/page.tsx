'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Upload } from 'lucide-react'
import type { Category } from '@/lib/types/database'

export default function CreateItemPage() {
    const router = useRouter()
    const { profile: currentUser } = useAuth()
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [form, setForm] = useState({
        category_id: '', name: '', code: '', barcode: '', description: '',
        condition: 'good', location: '', is_active: true,
    })

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const { data } = await supabase.from('categories').select('*').eq('is_active', true)
            setCategories(data || [])
        }
        load()
    }, [])

    function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Gagal: Ukuran file maksimal 2MB')
            e.target.value = ''
            return
        }

        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()

        let imagePath = null
        if (imageFile) {
            const ext = imageFile.name.split('.').pop()
            const path = `${Date.now()}.${ext}`
            const { error } = await supabase.storage.from('items').upload(path, imageFile)
            if (error) { toast.error('Gagal upload gambar'); setLoading(false); return }
            imagePath = path
        }

        const { error } = await supabase.from('items').insert({
            ...form,
            category_id: parseInt(form.category_id),
            image: imagePath,
        })

        if (error) { toast.error('Gagal: ' + error.message); setLoading(false); return }

        await supabase.from('audit_logs').insert({
            user_id: currentUser?.id, action: 'create', model_type: 'item',
            description: `Menambah barang: ${form.name}`,
        })

        toast.success('Barang berhasil ditambahkan')
        router.push('/admin/items')
        setLoading(false)
    }

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-4 h-4" /></Button>
                <div><h1 className="text-2xl font-bold">Tambah Barang</h1><p className="text-muted-foreground">Tambah barang baru ke inventaris</p></div>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Kategori *</Label>
                            <Select value={form.category_id} onValueChange={(v) => setForm(f => ({ ...f, category_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label>Nama Barang *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Kode *</Label><Input value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} required placeholder="AU-001" /></div>
                            <div className="space-y-2"><Label>Barcode *</Label><Input value={form.barcode} onChange={(e) => setForm(f => ({ ...f, barcode: e.target.value }))} required placeholder="ITM000001" /></div>
                        </div>
                        <div className="space-y-2"><Label>Deskripsi</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Kondisi</Label>
                                <Select value={form.condition} onValueChange={(v) => setForm(f => ({ ...f, condition: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="good">Baik</SelectItem>
                                        <SelectItem value="fair">Cukup</SelectItem>
                                        <SelectItem value="poor">Buruk</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2"><Label>Lokasi</Label><Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Rak A1" /></div>
                        </div>
                        <div className="space-y-2">
                            <Label>Gambar (max 2MB)</Label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background cursor-pointer hover:bg-muted transition-colors">
                                    <Upload className="w-4 h-4" />
                                    <span className="text-sm">Pilih File</span>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                </label>
                                {imagePreview && <img src={imagePreview} alt="preview" className="w-12 h-12 rounded object-cover" />}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Status Aktif</Label>
                            <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Simpan Barang
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
