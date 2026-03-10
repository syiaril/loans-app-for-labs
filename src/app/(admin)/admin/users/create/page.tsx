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
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function CreateUserPage() {
    const router = useRouter()
    const { profile: currentUser } = useAuth()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        name: '', email: '', password: 'password123', role: 'borrower',
        description: '', department: '', card_barcode: '', pin: '', is_approved: true,
    })

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()

        const email = form.email || `user_${Date.now()}@lab.internal`

        // Create auth user via signup
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password: form.password || 'password123',
        })

        if (authError || !authData.user) {
            toast.error('Gagal membuat akun: ' + (authError?.message || ''))
            setLoading(false)
            return
        }

        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            name: form.name,
            email,
            role: form.role,
            description: form.description || null,
            department: form.department || null,
            card_barcode: form.card_barcode || null,
            pin: form.pin || null,
            is_approved: form.is_approved,
        })

        if (profileError) {
            toast.error('Gagal menyimpan profil: ' + profileError.message)
            setLoading(false)
            return
        }

        await supabase.from('audit_logs').insert({
            user_id: currentUser?.id,
            action: 'create',
            model_type: 'profile',
            description: `Membuat pengguna baru: ${form.name}`,
        })

        toast.success('Pengguna berhasil dibuat')
        router.push('/admin/users')
        setLoading(false)
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
                            <Input value={form.card_barcode} onChange={(e) => setForm(f => ({ ...f, card_barcode: e.target.value }))} placeholder="Opsional" />
                        </div>
                        <div className="space-y-2">
                            <Label>PIN (6 digit)</Label>
                            <Input maxLength={6} value={form.pin} onChange={(e) => setForm(f => ({ ...f, pin: e.target.value }))} placeholder="Opsional" />
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
