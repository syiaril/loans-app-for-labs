'use client'

import { useState, useEffect, use } from 'react'
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
import type { Category, Item } from '@/lib/types/database'

export default function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { profile: currentUser } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [form, setForm] = useState<Partial<Item>>({})
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const [{ data: item }, { data: cats }] = await Promise.all([
                supabase.from('items').select('*').eq('id', id).single(),
                supabase.from('categories').select('*').eq('is_active', true),
            ])
            if (item) {
                setForm(item)
                if (item.image) {
                    const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(item.image)
                    setImagePreview(publicUrl)
                }
            }
            setCategories(cats || [])
            setLoading(false)
        }
        load()
    }, [id])

    function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 2 * 1024 * 1024) { toast.error('Ukuran maksimal 2MB'); return }
        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const supabase = createClient()

        let imagePath = form.image || null
        if (imageFile) {
            if (form.image) await supabase.storage.from('items').remove([form.image])
            const ext = imageFile.name.split('.').pop()
            const path = `${Date.now()}.${ext}`
            const { error } = await supabase.storage.from('items').upload(path, imageFile)
            if (error) { toast.error('Gagal upload gambar'); setSaving(false); return }
            imagePath = path
        }

        const { error } = await supabase.from('items').update({
            category_id: form.category_id, name: form.name, code: form.code, barcode: form.barcode,
            description: form.description, condition: form.condition, location: form.location,
            is_active: form.is_active, image: imagePath,
        }).eq('id', id)

        if (error) { toast.error('Gagal: ' + error.message); setSaving(false); return }

        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'update', model_type: 'item', model_id: parseInt(id), description: `Mengubah barang: ${form.name}` })
        toast.success('Barang berhasil diperbarui')
        router.push('/admin/items')
        setSaving(false)
    }

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-4 h-4" /></Button>
                <div><h1 className="text-2xl font-bold">Edit Barang</h1><p className="text-muted-foreground">{form.name}</p></div>
            </div>
            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Kategori *</Label>
                            <Select value={String(form.category_id)} onValueChange={(v) => setForm(f => ({ ...f, category_id: parseInt(v) }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label>Nama *</Label><Input value={form.name || ''} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Kode *</Label><Input value={form.code || ''} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} required /></div>
                            <div className="space-y-2"><Label>Barcode *</Label><Input value={form.barcode || ''} onChange={(e) => setForm(f => ({ ...f, barcode: e.target.value }))} required /></div>
                        </div>
                        <div className="space-y-2"><Label>Deskripsi</Label><Textarea value={form.description || ''} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Kondisi</Label>
                                <Select value={form.condition || 'good'} onValueChange={(v) => setForm(f => ({ ...f, condition: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="good">Baik</SelectItem><SelectItem value="fair">Cukup</SelectItem><SelectItem value="poor">Buruk</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2"><Label>Lokasi</Label><Input value={form.location || ''} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                        </div>
                        <div className="space-y-2">
                            <Label>Gambar</Label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background cursor-pointer hover:bg-muted transition-colors">
                                    <Upload className="w-4 h-4" /><span className="text-sm">Pilih File</span>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                </label>
                                {imagePreview && <img src={imagePreview} alt="preview" className="w-12 h-12 rounded object-cover" />}
                            </div>
                        </div>
                        <div className="flex items-center justify-between"><Label>Status Aktif</Label><Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} /></div>
                        <Button type="submit" className="w-full" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Simpan Perubahan</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
