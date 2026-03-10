import AdminSidebar from '@/components/layout/admin-sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar />
            <main className="lg:ml-64 p-6 pt-16 lg:pt-6">
                {children}
            </main>
        </div>
    )
}
