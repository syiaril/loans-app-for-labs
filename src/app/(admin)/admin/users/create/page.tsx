'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

export default function CreateUserPage() {
    const router = useRouter()
    const { profile: currentUser } = useAuth()
    const [loading, setLoading] = useState(false)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [form, setForm] = useState({
        name: '', email: '', password: 'password123', role: 'borrower',
        description: '', department: '', card_barcode: '', pin: '', is_approved: true,
    })

    function generateNumericBarcode() {
        // Generate a 12-digit numeric barcode (e.g. timestamp + random)
        const timestampPart = Date.now().toString().slice(-8); // Last 8 digits of timestamp
        const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return timestampPart + randomPart;
    }

    // Auto-generate barcode on mount
    useState(() => {
        if (!form.card_barcode) {
            setForm(f => ({ ...f, card_barcode: generateNumericBarcode() }))
        }
    })

    function handleRegenerateBarcode() {
        setForm(f => ({ ...f, card_barcode: generateNumericBarcode() }))
    }

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

        const email = form.email || `user_${Date.now()}@lab.internal`

        try {
            const supabase = createClient()
            let imagePath = null

            if (imageFile) {
                const ext = imageFile.name.split('.').pop()
                const path = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
                const { error: uploadError } = await supabase.storage.from('profiles').upload(path, imageFile)
                if (uploadError) {
                    throw new Error('Gagal upload foto: ' + uploadError.message)
                }
                imagePath = path
            }

            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    email,
                    password: form.password || 'password123',
                    photo: imagePath,
                })
            })

            const json = await res.json()
            if (!res.ok) {
                throw new Error(json.error || 'Gagal menyimpan pengguna')
            }

            toast.success('Pengguna berhasil dibuat')
            router.push('/admin/users')
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Terjadi kesalahan sistem'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Tambah Pengguna</h1>
                    <p className="text-muted-foreground">Buat akun pengguna baru</p>
                </div>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nama Lengkap *</Label>
                            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Opsional" />
                        </div>
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Default: password123" />
                        </div>
                        <div className="space-y-2">
                            <Label>Role *</Label>
                            <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="borrower">Peminjam</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Keterangan</Label>
                            <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Siswa / Guru / dll" />
                        </div>
                        <div className="space-y-2">
                            <Label>Departemen / Kelas</Label>
                            <Input value={form.department} onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))} placeholder="XII IPA 1" />
                        </div>
                        <div className="space-y-2">
                            <Label>Barcode Kartu</Label>
                            <div className="flex items-center gap-2">
                                <Input value={form.card_barcode} onChange={(e) => setForm(f => ({ ...f, card_barcode: e.target.value }))} placeholder="Otomatis terisi" />
                                <Button type="button" variant="outline" size="icon" onClick={handleRegenerateBarcode} title="Generate ulang barcode">
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>PIN (6 digit)</Label>
                            <Input maxLength={6} value={form.pin} onChange={(e) => setForm(f => ({ ...f, pin: e.target.value }))} placeholder="Opsional" />
                        </div>
                        <div className="space-y-2">
                            <Label>Foto Profil (max 2MB)</Label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background cursor-pointer hover:bg-muted transition-colors">
                                    <span className="text-sm">Pilih File</span>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                </label>
                                {imagePreview && <img src={imagePreview} alt="preview" className="w-12 h-12 rounded object-cover" />}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Status Aktif</Label>
                            <Switch checked={form.is_approved} onCheckedChange={(v) => setForm(f => ({ ...f, is_approved: v }))} />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Simpan Pengguna
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
