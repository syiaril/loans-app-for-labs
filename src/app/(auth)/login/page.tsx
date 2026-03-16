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
import { FlaskConical, LogIn, UserPlus, ScanBarcode, Eye, EyeOff, Loader2 } from 'lucide-react'
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
        const now = new Date()
        const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        const { data: loan, error: loanError } = await supabase
            .from('loans')
            .insert({
                user_id: userId,
                loan_code: loanCode,
                status: 'borrowed',
                borrowed_at: now.toISOString(),
                due_date: dueDate.toISOString(),
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

        // Sanitize scanner input: some scanners inject double quotes around the string
        const cleanBarcode = barcode.replace(/"/g, '').trim()

        try {
            // Call the secure API route to bypass RLS for unauthenticated profiles read
            const res = await fetch('/api/auth/barcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode: cleanBarcode }),
            })

            if (!res.ok) {
                console.error('Barcode login failed. API returned:', res.status)
                toast.error(`Kartu tidak ditemukan. Barcode yang discan: "${cleanBarcode}"`)
                setBarcode('')
                if (barcodeInputRef.current) {
                    barcodeInputRef.current.value = ''
                    barcodeInputRef.current.focus()
                }
                setLoading(false)
                return
            }

            const profile = await res.json()

            if (!profile) {
                toast.error('Data profil tidak valid.')
                setLoading(false)
                return
            }

            if (profile.pin && !showPinInput) {
                setBarcodeUser(profile)
                setPin('') // Ensure PIN is cleared when switching to PIN input
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

        } catch (err: any) {
            console.error('Login error:', err)
            toast.error('Terjadi kesalahan jaringan')
            setLoading(false)
        }
    }


    async function handleGuestRegister(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch('/api/auth/guest-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    guestName, 
                    guestDescription, 
                    guestDepartment 
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                toast.error('Registrasi gagal: ' + (data.error || 'Unknown error'))
                setLoading(false)
                return
            }

            // Client-side login to establish session
            const supabase = createClient()
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            })

            if (signInError) {
                toast.error('Registrasi sukses, tapi gagal masuk otomatis. Silakan lapor ke Admin.')
                setLoading(false)
                return
            }

            toast.success('Registrasi berhasil! Menunggu persetujuan admin.')
            router.push('/pending-approval')
        } catch (err: any) {
            console.error('Guest registration error:', err)
            toast.error('Terjadi kesalahan jaringan saat registrasi')
        } finally {
            setLoading(false)
        }
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
                            <TabsList className="grid w-full grid-cols-3 h-14 bg-muted/50 p-1.5 rounded-xl">
                                <TabsTrigger value="barcode" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all text-xs sm:text-sm">
                                    <ScanBarcode className="w-4 h-4 mr-2" />
                                    Barcode
                                </TabsTrigger>
                                <TabsTrigger value="manual" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all text-xs sm:text-sm">
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Email
                                </TabsTrigger>
                                <TabsTrigger value="guest" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all text-xs sm:text-sm">
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Tamu
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="manual">
                                <form onSubmit={handleManualLogin} className="space-y-6 mt-6">
                                    <div className="space-y-3">
                                        <Label htmlFor="email" className="text-sm font-semibold pl-1">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="nama@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="h-14 text-base px-4 rounded-xl bg-background/50 border-border/60 focus:bg-background transition-all"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="password" className="text-sm font-semibold pl-1">Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                className="h-14 text-base px-4 rounded-xl bg-background/50 border-border/60 focus:bg-background transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-all"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all" disabled={loading}>
                                        {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Memproses...</> : 'Masuk'}
                                    </Button>
                                </form>
                            </TabsContent>

                            <TabsContent value="barcode">
                                <form onSubmit={handleBarcodeLogin} className="space-y-6 mt-6">
                                    <div className="space-y-3">
                                        <Label htmlFor="barcode" className="text-sm font-semibold pl-1">Scan Barcode Kartu ID</Label>
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
                                                className="h-14 text-base px-4 rounded-xl bg-background/50 border-border/60 focus:bg-background transition-all"
                                            />
                                        </div>
                                    </div>
                                    {showPinInput && (
                                        <div className="space-y-6 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-top-4 duration-300">
                                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                                <p className="text-sm font-bold text-emerald-600 mb-1">
                                                    Identitas Ditemukan!
                                                </p>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    Halo <strong>{barcodeUser?.name}</strong>, silakan masukkan PIN Anda untuk melanjutkan peminjaman.
                                                </p>
                                            </div>
                                            <div className="space-y-3">
                                                <Label htmlFor="pin" className="text-sm font-semibold pl-1">PIN Keamanan (6 digit)</Label>
                                                <Input
                                                    id="pin"
                                                    type="password"
                                                    maxLength={6}
                                                    placeholder="Masukkan PIN"
                                                    value={pin}
                                                    onChange={(e) => setPin(e.target.value)}
                                                    autoFocus
                                                    autoComplete="new-password"
                                                    required
                                                    className="h-14 text-center tracking-[1em] text-2xl font-black rounded-xl bg-background/50 border-border/60 focus:bg-background transition-all"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <Button type="submit" className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all" disabled={loading}>
                                        {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Memproses...</> : showPinInput ? 'MASUK SEKARANG' : 'Cek Barcode'}
                                    </Button>
                                    {showPinInput && (
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            className="w-full h-12 rounded-xl mt-2 active:scale-95 transition-all text-muted-foreground"
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
                                <form onSubmit={handleGuestRegister} className="space-y-5 mt-6">
                                    <div className="space-y-2.5">
                                        <Label htmlFor="guestName" className="text-sm font-semibold pl-1">Nama Lengkap</Label>
                                        <Input
                                            id="guestName"
                                            placeholder="Nama lengkap"
                                            value={guestName}
                                            onChange={(e) => setGuestName(e.target.value)}
                                            required
                                            className="h-14 text-base px-4 rounded-xl bg-background/50 border-border/60 focus:bg-background transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label htmlFor="guestDesc" className="text-sm font-semibold pl-1">Keterangan</Label>
                                        <Input
                                            id="guestDesc"
                                            placeholder="Siswa / Guru / dll"
                                            value={guestDescription}
                                            onChange={(e) => setGuestDescription(e.target.value)}
                                            required
                                            className="h-14 text-base px-4 rounded-xl bg-background/50 border-border/60 focus:bg-background transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label htmlFor="guestDept" className="text-sm font-semibold pl-1">Kelas / Jurusan / Instansi</Label>
                                        <Input
                                            id="guestDept"
                                            placeholder="XII RPL 1 / dll"
                                            value={guestDepartment}
                                            onChange={(e) => setGuestDepartment(e.target.value)}
                                            required
                                            className="h-14 text-base px-4 rounded-xl bg-background/50 border-border/60 focus:bg-background transition-all"
                                        />
                                    </div>
                                    <Button type="submit" className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all" disabled={loading}>
                                        {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Memproses...</> : 'Daftar sebagai Tamu'}
                                    </Button>
                                    <p className="text-[10px] text-muted-foreground text-center italic">
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

                <div className="text-center mt-6">
                    <Button variant="ghost" className="h-12 rounded-xl text-muted-foreground hover:text-foreground active:scale-95 transition-all" onClick={() => router.push('/')}>
                        ← Kembali ke Halaman Scan
                    </Button>
                </div>
            </div>
        </div>
    )
}
