'use client'

import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
    FlaskConical, Home, Package, ShoppingCart, Undo2, LogOut,
    Sun, Moon, Menu, X
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useState } from 'react'

const navItems = [
    { href: '/borrower/dashboard', label: 'Dashboard', icon: Home },
    { href: '/borrower/borrow', label: 'Pinjam Barang', icon: ShoppingCart },
    { href: '/borrower/return', label: 'Pengembalian', icon: Undo2 },
]

export default function BorrowerNavbar() {
    const router = useRouter()
    const pathname = usePathname()
    const { profile } = useAuth()
    const { theme, setTheme } = useTheme()
    const [mobileOpen, setMobileOpen] = useState(false)

    async function handleLogout() {
        const logoutToast = toast.loading('Sedang keluar...')
        try {
            const supabase = createClient()

            // Fire and forget audit log (or fire but don't strictly wait to finish before signOut)
            if (profile?.id) {
                supabase.from('audit_logs').insert({
                    user_id: profile.id,
                    action: 'logout',
                    description: 'Logout dari aplikasi',
                }).then(({ error }: { error: any }) => {
                    if (error) console.error('Failed to log logout:', error)
                })
            }

            const { error } = await supabase.auth.signOut()
            if (error) throw error

            toast.success('Berhasil logout', { id: logoutToast })
            window.location.href = '/login'
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            toast.error('Gagal logout: ' + message, { id: logoutToast })
        }
    }

    return (
        <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center p-2 shadow-sm">
                            <img src="https://skensa-rpl.com/images/logo_rpl.png" alt="Logo Pojok Lab" className="w-full h-full object-contain" />
                        </div>
                        <span className="font-bold hidden sm:block">Pojok Lab</span>
                    </div>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-2">
                        {navItems.map((item) => (
                            <Button
                                key={item.href}
                                variant={pathname === item.href ? 'secondary' : 'ghost'}
                                size="lg"
                                onClick={() => router.push(item.href)}
                                className="h-12 gap-2 px-5 rounded-xl transition-all active:scale-95"
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                            </Button>
                        ))}
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-12 h-12 rounded-xl active:scale-90 transition-all"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
                        </Button>
                        <div className="hidden md:flex items-center gap-3 ml-2">
                            <span className="text-sm font-semibold text-muted-foreground">{profile?.name.split(' ')[0]}</span>
                            <Button variant="ghost" size="icon" className="w-12 h-12 rounded-xl text-destructive hover:bg-destructive/10 active:scale-90 transition-all" onClick={handleLogout}>
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden w-12 h-12 rounded-xl bg-muted/50 active:scale-90 transition-all"
                            onClick={() => setMobileOpen(!mobileOpen)}
                        >
                            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </Button>
                    </div>
                </div>

                {/* Mobile Nav */}
                {mobileOpen && (
                    <div className="md:hidden pb-6 space-y-2 animate-in slide-in-from-top-4 duration-300">
                        {navItems.map((item) => (
                            <Button
                                key={item.href}
                                variant={pathname === item.href ? 'secondary' : 'ghost'}
                                className="w-full h-16 justify-start gap-4 px-6 rounded-2xl text-base"
                                onClick={() => {
                                    router.push(item.href)
                                    setMobileOpen(false)
                                }}
                            >
                                <item.icon className="w-6 h-6" />
                                <span className="font-semibold">{item.label}</span>
                            </Button>
                        ))}
                        <div className="pt-4 mt-2 border-t border-border/50">
                            <div className="flex items-center justify-between px-6 py-3 bg-muted/30 rounded-2xl mb-2">
                                <span className="text-sm font-bold truncate">{profile?.name}</span>
                                <Badge variant="outline" className="uppercase text-[10px] tracking-widest">{profile?.role}</Badge>
                            </div>
                            <Button variant="ghost" className="w-full h-16 justify-start gap-4 px-6 rounded-2xl text-destructive hover:bg-destructive/10 active:scale-95 transition-all" onClick={handleLogout}>
                                <LogOut className="w-6 h-6" />
                                <span className="font-bold">Keluar Aplikasi</span>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    )
}
