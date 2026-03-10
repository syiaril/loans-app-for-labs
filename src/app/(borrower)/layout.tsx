import BorrowerNavbar from '@/components/layout/borrower-navbar'

export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background">
            <BorrowerNavbar />
            <main className="max-w-7xl mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    )
}
