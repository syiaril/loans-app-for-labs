'use client'

import AdminSidebar from '@/components/layout/admin-sidebar'
import { SidebarProvider, useSidebar } from '@/hooks/use-sidebar'

function AdminContent({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar()
    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar />
            <main className={`transition-all duration-300 p-6 pt-16 lg:pt-6 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
                {children}
            </main>
        </div>
    )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AdminContent>{children}</AdminContent>
        </SidebarProvider>
    )
}
