'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/hooks/use-cart'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { generateLoanCode } from '@/lib/utils'
import { Package, Trash2, ShoppingCart, CheckCircle, Loader2 } from 'lucide-react'

export default function CheckoutPage() {
    const router = useRouter()
    const { items: cartItems, removeItem, clearCart } = useCart()
    const { user } = useAuth()
    const [notes, setNotes] = useState('')
    const [processing, setProcessing] = useState(false)
    const [loanResult, setLoanResult] = useState<{ code: string; count: number } | null>(null)

    async function handleCheckout() {
        if (!user || cartItems.length === 0) return
        setProcessing(true)

        const supabase = createClient()
        const loanCode = generateLoanCode()
        const now = new Date()
        const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        const { data: loan, error } = await supabase
            .from('loans')
            .insert({
                user_id: user.id,
                loan_code: loanCode,
                status: 'borrowed',
                borrowed_at: now.toISOString(),
                due_date: dueDate.toISOString(),
                notes: notes || null,
            })
            .select()
            .single()

        if (error || !loan) {
            toast.error('Gagal membuat peminjaman: ' + (error?.message || ''))
            setProcessing(false)
            return
        }

        // Insert loan items
        const loanItemsData = cartItems.map((item) => ({
            loan_id: loan.id,
            item_id: item.id,
            condition_before: 'good' as const,
        }))

        const { error: liError } = await supabase.from('loan_items').insert(loanItemsData)
        if (liError) {
            toast.error('Gagal menambahkan item peminjaman')
            setProcessing(false)
            return
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'borrow',
            model_type: 'loan',
            model_id: loan.id,
            description: `Peminjaman ${cartItems.length} barang (${loanCode})`,
            new_values: { items: cartItems.map(i => i.name) },
        })

        setLoanResult({ code: loanCode, count: cartItems.length })
        clearCart()
        toast.success('Peminjaman berhasil!')
        setProcessing(false)
    }

    if (loanResult) {
        return (
            <div className="max-w-md mx-auto mt-12 px-4">
                <Card className="backdrop-blur-xl bg-card/80 border-border/50 text-center shadow-2xl rounded-3xl overflow-hidden">
                    <CardContent className="pt-12 pb-10 space-y-6">
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto border border-emerald-500/20">
                            <CheckCircle className="w-10 h-10 text-emerald-500" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black">Berhasil Dipinjam!</h2>
                            <p className="text-sm text-muted-foreground px-6 leading-relaxed">
                                {loanResult.count} barang telah dicatat atas nama Anda. Silakan ambil barang di rak yang sesuai.
                            </p>
                        </div>
                        <div className="p-6 rounded-2xl bg-muted/40 border border-border/50 mx-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Kode Peminjaman</p>
                            <p className="text-3xl font-mono font-black text-primary tracking-tighter">{loanResult.code}</p>
                        </div>
                        <div className="px-6">
                            <Button className="w-full h-16 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all" onClick={() => router.push('/borrower/dashboard')}>
                                Ke Dashboard Saya
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (cartItems.length === 0) {
        return (
            <div className="max-w-md mx-auto mt-20 text-center space-y-6 px-4">
                <div className="w-24 h-24 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto border border-border/40">
                    <ShoppingCart className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Keranjang Kosong</h2>
                    <p className="text-muted-foreground">Anda belum memilih barang untuk dipinjam.</p>
                </div>
                <Button className="h-16 px-10 rounded-2xl text-lg font-bold active:scale-95 transition-all" onClick={() => router.push('/borrower/borrow')}>
                    Cari Barang Sekarang
                </Button>
            </div>
        )
    }

    return (
        <div className="max-w-lg mx-auto space-y-8 pb-20 px-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight">Checkout</h1>
                <p className="text-muted-foreground font-medium mt-1">Konfirmasi daftar barang pinjaman Anda</p>
            </div>

            <Card className="backdrop-blur-xl bg-card/60 border-border/40 shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Daftar Barang ({cartItems.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                    <div className="space-y-2.5">
                        {cartItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/20 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-background border border-border/40 flex items-center justify-center shadow-sm">
                                        <Package className="w-6 h-6 text-muted-foreground/50" />
                                    </div>
                                    <div className="max-w-[180px] sm:max-w-xs">
                                        <p className="text-sm font-bold truncate">{item.name}</p>
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.code} • {item.category_name}</p>
                                    </div>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-12 w-12 rounded-full text-destructive hover:bg-destructive/10 active:scale-90 transition-all shrink-0"
                                    onClick={() => removeItem(item.id)}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <div className="space-y-3">
                    <Label className="text-sm font-bold ml-2">Catatan Tambahan (opsional)</Label>
                    <Textarea
                        placeholder="Contoh: Digunakan untuk praktik RPL kelas XII..."
                        className="min-h-[100px] rounded-3xl bg-card/60 border-border/40 p-5 text-base focus:bg-card transition-all"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
                
                <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Loader2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-xs sm:text-sm text-blue-600 font-medium leading-relaxed">
                        Peminjaman ini berlaku selama <strong>24 Jam</strong> dan akan jatuh tempo pada <strong>{new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>.
                    </p>
                </div>

                <Button 
                    className="w-full h-18 py-8 rounded-3xl text-xl font-black shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all" 
                    onClick={handleCheckout} 
                    disabled={processing}
                >
                    {processing ? (
                        <>
                            <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                            MEMPROSES...
                        </>
                    ) : (
                        `PINJAM SEKARANG (${cartItems.length})`
                    )}
                </Button>
            </div>
        </div>
    )

}
