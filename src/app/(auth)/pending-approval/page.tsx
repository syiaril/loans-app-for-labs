'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FlaskConical, Loader2, CheckCircle } from 'lucide-react'

export default function PendingApprovalPage() {
    const router = useRouter()
    const [checking, setChecking] = useState(true)
    const [approved, setApproved] = useState(false)

    useEffect(() => {
        const supabase = createClient()

        const interval = setInterval(async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_approved, role')
                .eq('id', user.id)
                .single()

            if (profile?.is_approved) {
                setApproved(true)
                setTimeout(() => {
                    if (profile.role === 'admin') {
                        router.push('/admin/dashboard')
                    } else {
                        router.push('/borrower/dashboard')
                    }
                }, 2000)
            }
            setChecking(false)
        }, 5000)

            // Initial check
            ; (async () => {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push('/login')
                    return
                }
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('is_approved, role')
                    .eq('id', user.id)
                    .single()

                if (profile?.is_approved) {
                    setApproved(true)
                    setTimeout(() => {
                        router.push(profile.role === 'admin' ? '/admin/dashboard' : '/borrower/dashboard')
                    }, 1000)
                }
                setChecking(false)
            })()

        return () => clearInterval(interval)
    }, [router])

    async function handleLogout() {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
            </div>

            <Card className="w-full max-w-md backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mx-auto mb-4">
                        {approved ? (
                            <CheckCircle className="w-8 h-8 text-emerald-400" />
                        ) : (
                            <FlaskConical className="w-8 h-8 text-yellow-400" />
                        )}
                    </div>
                    <CardTitle>
                        {approved ? 'Akun Disetujui!' : 'Menunggu Persetujuan'}
                    </CardTitle>
                    <CardDescription>
                        {approved
                            ? 'Akun Anda telah disetujui. Mengalihkan...'
                            : 'Akun tamu Anda sedang menunggu persetujuan dari admin laboratorium.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!approved && (
                        <>
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">
                                    {checking ? 'Memeriksa status...' : 'Memeriksa setiap 5 detik...'}
                                </span>
                            </div>
                            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <p className="text-sm text-yellow-400 text-center">
                                    Halaman ini akan otomatis mengalihkan setelah admin menyetujui akun Anda.
                                </p>
                            </div>
                            <Button variant="outline" className="w-full" onClick={handleLogout}>
                                Keluar
                            </Button>
                        </>
                    )}
                    {approved && (
                        <div className="flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
