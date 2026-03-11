'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { FlaskConical, LogIn, UserPlus, ScanBarcode, Eye, EyeOff } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { generateLoanCode } from '@/lib/utils'

export default function LoginPage() {
    const router = useRouter()
    const { items: cartItems, clearCart } = useCart()
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    // Manual login state
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    // Barcode login state
    const [barcode, setBarcode] = useState('')
    const [pin, setPin] = useState('')
    const [showPinInput, setShowPinInput] = useState(false)
    const [barcodeUser, setBarcodeUser] = useState<{ id: string; email: string; name: string; pin: string | null } | null>(null)
    const barcodeInputRef = useRef<HTMLInputElement>(null)

    // Global Keydown listener for the scanner
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return

            const activeElement = document.activeElement as HTMLElement
            const isInput = activeElement.tagName === 'INPUT' || 
                            activeElement.tagName === 'TEXTAREA' || 
                            activeElement.isContentEditable

            if (isInput && activeElement !== barcodeInputRef.current) return

            if (activeElement !== barcodeInputRef.current && barcodeInputRef.current && !showPinInput) {
                barcodeInputRef.current.focus()
                if (e.key.length === 1) {
                    barcodeInputRef.current.value += e.key
                    setBarcode(barcodeInputRef.current.value)
                    e.preventDefault() 
                }
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [showPinInput])

    // Guest registration state
    const [guestName, setGuestName] = useState('')
    const [guestDescription, setGuestDescription] = useState('')
    const [guestDepartment, setGuestDepartment] = useState('')

    async function processCartAfterLogin(userId: string) {
        if (cartItems.length === 0) return

        const supabase = createClient()
        const loanCode = generateLoanCode()
        const now = new Date().toISOString()
        const dueDate = new Date()
        dueDate.setHours(23, 59, 59, 999)

        const { data: loan, error: loanError } = await supabase
            .from('loans')
            .insert({
                user_id: userId,
                loan_code: loanCode,
                status: 'borrowed',
                borrowed_at: now,
                due_date: dueDate.toISOString().split('T')[0],
                notes: 'Peminjaman otomatis dari scan publik',
            })
            .select()
            .single()

        if (loanError || !loan) {
            toast.error('Gagal membuat peminjaman otomatis: ' + (loanError?.message || 'Unknown error'))
            return false
        }

        const loanItemsData = cartItems.map((item) => ({
            loan_id: loan.id,
            item_id: item.id,
            condition_before: 'good' as const,
        }))

        await supabase.from('loan_items').insert(loanItemsData)

        // Audit log
        await supabase.from('audit_logs').insert({
            user_id: userId,
            action: 'borrow',
            model_type: 'loan',
            model_id: loan.id,
            description: `Peminjaman otomatis ${cartItems.length} barang (${loanCode})`,
        })

        clearCart()
        toast.success(`Peminjaman berhasil! Kode: ${loanCode}`)
        return true
    }

    async function handleManualLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()

        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            toast.error('Login gagal: ' + error.message)
            setLoading(false)
            return
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_approved')
            .eq('id', data.user.id)
            .single()

        // Log audit
        await supabase.from('audit_logs').insert({
            user_id: data.user.id,
            action: 'login',
            description: 'Login via email/password',
        })

        if (profile && !profile.is_approved) {
            router.push('/pending-approval')
            return
        }

        const success = await processCartAfterLogin(data.user.id)
        if (cartItems.length > 0 && !success) {
            setLoading(false)
            return
        }

        if (profile?.role === 'admin') {
            router.push('/admin/dashboard')
        } else {
            router.push('/borrower/dashboard')
        }
        setLoading(false)
    }

    async function handleBarcodeLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()

        // Sanitize scanner input: some scanners inject double quotes around the string (e.g. "1234")
        const cleanBarcode = barcode.replace(/"/g, '').trim()

        // Lookup user by barcode
        let { data: profile, error } = await supabase
            .from('profiles')
            .select('id, email, name, pin')
            .eq('card_barcode', cleanBarcode)
            .single()

        // Fallback for auto-generated barcodes (which are the first 12 chars of the user ID)
        if (error || !profile) {
            // Only try fallback if the scanned value looks like part of a UUID (alphanumeric, hyphens maybe, at least 8 chars)
            if (cleanBarcode.length >= 8) {
                const { data: fallbackProfiles } = await supabase
                    .from('profiles')
                    .select('id, email, name, pin')
                    .or('card_barcode.is.null,card_barcode.eq.')
                
                // Physical scanners often skip or drop hyphens. Strip hyphens from both before comparing.
                const cleanBarcodeNoHyphens = cleanBarcode.replace(/-/g, '')
                const matchedProfile = fallbackProfiles?.find(p => p.id.replace(/-/g, '').startsWith(cleanBarcodeNoHyphens))
                if (matchedProfile) {
                    profile = matchedProfile
                    error = null
                }
            }
        }

        if (error || !profile) {
            console.error('Barcode login failed. Scanned barcode:', `"${barcode}"`, 'Cleaned barcode:', `"${cleanBarcode}"`)
            toast.error(`Kartu tidak ditemukan. Barcode yang discan: "${cleanBarcode}"`)
            setBarcode('')
            if (barcodeInputRef.current) {
                barcodeInputRef.current.value = ''
                barcodeInputRef.current.focus()
            }
            setLoading(false)
            return
        }

        if (profile.pin && !showPinInput) {
            setBarcodeUser(profile)
            setShowPinInput(true)
            setLoading(false)
            return
        }

        if (profile.pin && pin !== profile.pin) {
            toast.error('PIN salah!')
            setLoading(false)
            return
        }

        // Sign in with stored email
        if (!profile.email) {
            toast.error('Akun ini tidak memiliki email terdaftar')
            setLoading(false)
            return
        }

        // Try standard passwords for seeded users if it's a known email pattern
        // In a real app, you'd have a more robust way to handle this
        const loginPassword = profile.email.includes('siswa') ? 'siswa123' :
            profile.email.includes('guru') ? 'guru1234' :
                profile.email.includes('admin') ? 'admin123' : 'password123'

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: profile.email,
            password: loginPassword,
        })

        if (authError) {
            toast.error('Login gagal: ' + authError.message)
            setLoading(false)
            return
        }

        await supabase.from('audit_logs').insert({
            user_id: authData.user.id,
            action: 'login',
            description: 'Login via scan barcode kartu',
        })

        const success = await processCartAfterLogin(authData.user.id)
        if (cartItems.length > 0 && !success) {
            setLoading(false)
            return
        }

        const { data: fullProfile } = await supabase
            .from('profiles')
            .select('role, is_approved')
            .eq('id', authData.user.id)
            .single()

        if (fullProfile && !fullProfile.is_approved) {
            router.push('/pending-approval')
        } else if (fullProfile?.role === 'admin') {
            router.push('/admin/dashboard')
        } else {
            router.push('/borrower/dashboard')
        }
        setLoading(false)
    }

    async function handleGuestRegister(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()

        const tempEmail = `guest_${Date.now()}@lab.internal`
        const tempPassword = 'password123'

        const { data, error } = await supabase.auth.signUp({
            email: tempEmail,
            password: tempPassword,
        })

        if (error || !data.user) {
            toast.error('Registrasi gagal: ' + (error?.message || 'Unknown error'))
            setLoading(false)
            return
        }

        const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            name: guestName,
            email: tempEmail,
            role: 'borrower',
            description: guestDescription,
            department: guestDepartment,
            is_approved: false,
        })

        if (profileError) {
            toast.error('Gagal menyimpan profil')
            setLoading(false)
            return
        }

        await supabase.from('audit_logs').insert({
            user_id: data.user.id,
            action: 'create',
            model_type: 'profile',
            description: `Registrasi tamu: ${guestName}`,
        })

        toast.success('Registrasi berhasil! Menunggu persetujuan admin.')
        router.push('/pending-approval')
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden bg-white border border-primary/20 mb-4 shadow-xl p-1.5">
                        <img src="https://skensa-rpl.com/images/logo_rpl.png" alt="Logo Pojok Lab" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold">Pojok Lab</h1>
                    <p className="text-muted-foreground mt-1">Sistem Peminjaman Barang Laboratorium</p>
                </div>

                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardHeader>
                        <CardTitle>Masuk</CardTitle>
                        <CardDescription>Pilih metode login di bawah ini</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="barcode" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="barcode" className="text-xs">
                                    <ScanBarcode className="w-3 h-3 mr-1" />
                                    Barcode
                                </TabsTrigger>
                                <TabsTrigger value="manual" className="text-xs">
                                    <LogIn className="w-3 h-3 mr-1" />
                                    Email
                                </TabsTrigger>
                                <TabsTrigger value="guest" className="text-xs">
                                    <UserPlus className="w-3 h-3 mr-1" />
                                    Tamu
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="manual">
                                <form onSubmit={handleManualLogin} className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="nama@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading ? 'Memproses...' : 'Masuk'}
                                    </Button>
                                </form>
                            </TabsContent>

                            <TabsContent value="barcode">
                                <form onSubmit={handleBarcodeLogin} className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="barcode">Scan Barcode Kartu ID</Label>
                                        <div className="relative">
                                            <Input
                                                id="barcode"
                                                ref={barcodeInputRef}
                                                placeholder="Scan atau ketik barcode kartu..."
                                                value={barcode}
                                                onChange={(e) => setBarcode(e.target.value)}
                                                disabled={showPinInput}
                                                autoFocus
                                                required
                                            />
                                        </div>
                                    </div>
                                    {showPinInput && (
                                        <div className="space-y-4 pt-2 border-t border-border/50">
                                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                <p className="text-sm font-medium text-emerald-500 mb-1">
                                                    Identitas Ditemukan!
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Halo <strong>{barcodeUser?.name}</strong>, silakan masukkan PIN Anda untuk melanjutkan peminjaman.
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="pin">PIN Keamanan (6 digit)</Label>
                                                <Input
                                                    id="pin"
                                                    type="password"
                                                    maxLength={6}
                                                    placeholder="Masukkan PIN"
                                                    value={pin}
                                                    onChange={(e) => setPin(e.target.value)}
                                                    autoFocus
                                                    required
                                                    className="text-center tracking-widest text-lg"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading ? 'Memproses...' : showPinInput ? 'MASUK SEKARANG' : 'Cek Barcode'}
                                    </Button>
                                    {showPinInput && (
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            className="w-full mt-2"
                                            onClick={() => {
                                                setShowPinInput(false)
                                                setBarcode('')
                                                setPin('')
                                                setBarcodeUser(null)
                                                setTimeout(() => barcodeInputRef.current?.focus(), 100)
                                            }}
                                        >
                                            Batal / Scan Ulang
                                        </Button>
                                    )}
                                </form>
                            </TabsContent>

                            <TabsContent value="guest">
                                <form onSubmit={handleGuestRegister} className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="guestName">Nama Lengkap</Label>
                                        <Input
                                            id="guestName"
                                            placeholder="Nama lengkap"
                                            value={guestName}
                                            onChange={(e) => setGuestName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="guestDesc">Keterangan</Label>
                                        <Input
                                            id="guestDesc"
                                            placeholder="Siswa / Guru / Dosen / dll"
                                            value={guestDescription}
                                            onChange={(e) => setGuestDescription(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="guestDept">Kelas / Jurusan / Instansi</Label>
                                        <Input
                                            id="guestDept"
                                            placeholder="XII IPA 1 / Teknik Kimia / dll"
                                            value={guestDepartment}
                                            onChange={(e) => setGuestDepartment(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading ? 'Memproses...' : 'Daftar sebagai Tamu'}
                                    </Button>
                                    <p className="text-xs text-muted-foreground text-center">
                                        Akun tamu perlu disetujui admin sebelum bisa meminjam.
                                    </p>
                                </form>
                            </TabsContent>
                        </Tabs>

                        {cartItems.length > 0 && (
                            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <p className="text-sm text-blue-400">
                                    📦 {cartItems.length} barang menunggu di keranjang. Login untuk memproses peminjaman.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="text-center mt-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                        ← Kembali ke Halaman Scan
                    </Button>
                </div>
            </div>
        </div>
    )
}
