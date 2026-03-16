'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Upload } from 'lucide-react'
import type { Profile } from '@/lib/types/database'

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { profile: currentUser } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<Partial<Profile>>({})
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
            if (data) {
                setForm(data)
                if (data.photo) {
                    const { data: publicUrlData } = supabase.storage.from('profiles').getPublicUrl(data.photo)
                    setImagePreview(publicUrlData.publicUrl)
                }
            }
            setLoading(false)
        }
        load()
    }, [id])

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
        setSaving(true)
        const supabase = createClient()

        let imagePath = form.photo

        if (imageFile) {
            const ext = imageFile.name.split('.').pop()
            const path = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
            const { error: uploadError } = await supabase.storage.from('profiles').upload(path, imageFile)
            if (uploadError) {
                toast.error('Gagal upload foto: ' + uploadError.message)
                setSaving(false)
                return
            }
            imagePath = path
        }

        const { error } = await supabase.from('profiles').update({
            name: form.name,
            role: form.role,
            description: form.description,
            department: form.department,
            card_barcode: form.card_barcode || null,
            pin: form.pin || null,
            is_approved: form.is_approved,
            photo: imagePath,
        }).eq('id', id)

        if (error) {
            toast.error('Gagal menyimpan: ' + error.message)
            setSaving(false)
            return
        }

        await supabase.from('audit_logs').insert({
            user_id: currentUser?.id,
            action: 'update',
            model_type: 'profile',
            description: `Mengubah data pengguna: ${form.name}`,
        })

        toast.success('Pengguna berhasil diperbarui')
        router.push('/admin/users')
        setSaving(false)
    }

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Edit Pengguna</h1>
                    <p className="text-muted-foreground">{form.name}</p>
                </div>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nama Lengkap *</Label>
                            <Input value={form.name || ''} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Role *</Label>
                            <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v as 'admin' | 'borrower' }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="borrower">Peminjam</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Keterangan</Label>
                            <Input value={form.description || ''} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Departemen / Kelas</Label>
                            <Input value={form.department || ''} onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Barcode Kartu</Label>
                            <Input value={form.card_barcode || ''} onChange={(e) => setForm(f => ({ ...f, card_barcode: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>PIN (6 digit)</Label>
                            <Input maxLength={6} value={form.pin || ''} onChange={(e) => setForm(f => ({ ...f, pin: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Foto Profil (max 2MB)</Label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background cursor-pointer hover:bg-muted transition-colors">
                                    <Upload className="w-4 h-4" />
                                    <span className="text-sm">Pilih File Baru</span>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                </label>
                                {imagePreview && <img src={imagePreview} alt="preview" className="w-12 h-12 rounded object-cover" />}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Status Aktif</Label>
                            <Switch checked={form.is_approved ?? true} onCheckedChange={(v) => setForm(f => ({ ...f, is_approved: v }))} />
                        </div>
                        <Button type="submit" className="w-full" disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Simpan Perubahan
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
