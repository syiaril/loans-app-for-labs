'use client'

import BorrowerNavbar from '@/components/layout/borrower-navbar'
import { useIdleLogout } from '@/hooks/use-idle-logout'

export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
    // Auto-logout after 1 minute (60000ms) of inactivity
    useIdleLogout(60000)

    return (
        <div className="min-h-screen bg-background">
            <BorrowerNavbar />
            <main className="max-w-7xl mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    )
}
