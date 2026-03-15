'use client'

import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useSidebar } from '@/hooks/use-sidebar'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
    FlaskConical, LayoutDashboard, Users, Package, FolderOpen,
    ClipboardList, AlertTriangle, BarChart3, LogOut, Sun, Moon,
    PanelLeft, Menu, FileText
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navGroups = [
    {
        label: 'Utama',
        items: [
            { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        label: 'Manajemen',
        items: [
            { href: '/admin/users', label: 'Pengguna', icon: Users },
            { href: '/admin/items', label: 'Barang', icon: Package },
            { href: '/admin/categories', label: 'Kategori', icon: FolderOpen },
        ],
    },
    {
        label: 'Peminjaman',
        items: [
            { href: '/admin/loans', label: 'Semua Peminjaman', icon: ClipboardList },
            { href: '/admin/loans/overdue', label: 'Terlambat', icon: AlertTriangle },
        ],
    },
    {
        label: 'Laporan',
        items: [
            { href: '/admin/reports/daily', label: 'Laporan Harian', icon: FileText },
            { href: '/admin/reports/monthly', label: 'Laporan Bulanan', icon: BarChart3 },
            { href: '/admin/reports/audit-log', label: 'Log Audit', icon: ClipboardList },
        ],
    },
]

export default function AdminSidebar() {
    const router = useRouter()
    const pathname = usePathname()
    const { profile } = useAuth()
    const { theme, setTheme } = useTheme()
    const { collapsed, toggle } = useSidebar()
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
                        description: 'Admin logout',
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

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Logo + Toggle */}
            <div className="p-4 border-b border-border/50">
                {collapsed ? (
                    /* Collapsed: just show toggle button centered */
                    <div className="flex justify-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 hidden lg:flex"
                            onClick={toggle}
                            title="Buka Sidebar"
                        >
                            <PanelLeft className="w-5 h-5 rotate-180" />
                        </Button>
                    </div>
                ) : (
                    /* Expanded: logo + title + toggle */
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 shrink-0 flex items-center justify-center p-1.5 shadow-sm">
                            <img src="https://skensa-rpl.com/images/logo_rpl.png" alt="Logo Pojok Lab" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm tracking-tight text-primary">Pojok Lab</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Admin Panel</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 hidden lg:flex h-8 w-8"
                            onClick={toggle}
                            title="Tutup Sidebar"
                        >
                            <PanelLeft className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Nav */}
            <ScrollArea className="flex-1 px-3 py-4">
                <div className="space-y-6">
                    {navGroups.map((group) => (
                        <div key={group.label}>
                            {!collapsed && (
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 px-3">
                                    {group.label}
                                </p>
                            )}
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                                    return (
                                        <Button
                                            key={item.href}
                                            variant={isActive ? 'secondary' : 'ghost'}
                                            className={cn(
                                                'w-full h-10 justify-start gap-3 rounded-lg px-3 font-medium transition-all active:scale-[0.98]',
                                                collapsed ? 'justify-center px-0' : ''
                                            )}
                                            onClick={() => {
                                                router.push(item.href)
                                                setMobileOpen(false)
                                            }}
                                            title={collapsed ? item.label : undefined}
                                        >
                                            <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                                            {!collapsed && <span>{item.label}</span>}
                                        </Button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-border/40 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-9 h-9 rounded-lg active:scale-90 transition-all"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-slate-700" />}
                    </Button>
                    {collapsed && (
                        <Button variant="ghost" size="icon" className="w-9 h-9 rounded-lg text-destructive hover:bg-destructive/10 active:scale-90 transition-all" onClick={handleLogout} title="Logout">
                            <LogOut className="w-4 h-4" />
                        </Button>
                    )}
                </div>
                {!collapsed && (
                    <div className="flex items-center gap-2 p-1.5 bg-background border border-border/40 rounded-xl shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-black text-primary border border-primary/20 shrink-0">
                            {profile?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 pr-1">
                            <p className="text-xs font-bold truncate">{profile?.name}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Admin Account</p>
                        </div>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 active:scale-90 transition-all shrink-0" onClick={handleLogout} title="Logout">
                            <LogOut className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <>
            {/* Mobile toggle */}
            <Button
                variant="ghost"
                size="icon"
                className="fixed top-4 left-4 z-50 lg:hidden w-11 h-11 rounded-xl bg-card border border-border/50 shadow-lg active:scale-90 transition-all"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                <Menu className="w-5 h-5" />
            </Button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed top-0 left-0 z-40 h-screen bg-card/95 backdrop-blur-xl border-r border-border/50 transition-all duration-300',
                    collapsed ? 'w-16' : 'w-64',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                {sidebarContent}
            </aside>
        </>
    )
}
