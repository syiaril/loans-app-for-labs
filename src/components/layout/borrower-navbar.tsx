'use client'

import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
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

            try {
                if (profile?.id) {
                    await supabase.from('audit_logs').insert({
                        user_id: profile.id,
                        action: 'logout',
                        description: 'Logout dari aplikasi',
                    })
                }
            } catch (e) {
                console.error('Failed to log logout:', e)
            }

            const { error } = await supabase.auth.signOut()
            if (error) throw error

            toast.success('Berhasil logout', { id: logoutToast })
            router.replace('/login')
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            toast.error('Gagal logout: ' + message, { id: logoutToast })
        }
    }

    return (
        <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center p-1">
                            <img src="https://skensa-rpl.com/images/logo_rpl.png" alt="Logo Pojok Lab" className="w-full h-full object-contain" />
                        </div>
                        <span className="font-semibold hidden sm:block">Pojok Lab</span>
                    </div>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => (
                            <Button
                                key={item.href}
                                variant={pathname === item.href ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => router.push(item.href)}
                                className="gap-2"
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </Button>
                        ))}
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </Button>
                        <div className="hidden md:flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{profile?.name}</span>
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setMobileOpen(!mobileOpen)}
                        >
                            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </Button>
                    </div>
                </div>

                {/* Mobile Nav */}
                {mobileOpen && (
                    <div className="md:hidden pb-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                        {navItems.map((item) => (
                            <Button
                                key={item.href}
                                variant={pathname === item.href ? 'secondary' : 'ghost'}
                                className="w-full justify-start gap-2"
                                onClick={() => {
                                    router.push(item.href)
                                    setMobileOpen(false)
                                }}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </Button>
                        ))}
                        <div className="pt-2 border-t border-border/50">
                            <p className="text-sm text-muted-foreground px-4 py-1">{profile?.name}</p>
                            <Button variant="ghost" className="w-full justify-start gap-2 text-destructive" onClick={handleLogout}>
                                <LogOut className="w-4 h-4" />
                                Keluar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    )
}
