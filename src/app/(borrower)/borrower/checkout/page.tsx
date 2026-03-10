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
        const now = new Date().toISOString()
        const dueDate = new Date()
        dueDate.setHours(23, 59, 59, 999)

        const { data: loan, error } = await supabase
            .from('loans')
            .insert({
                user_id: user.id,
                loan_code: loanCode,
                status: 'borrowed',
                borrowed_at: now,
                due_date: dueDate.toISOString().split('T')[0],
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

        // Update item statuses
        for (const item of cartItems) {
            await supabase.from('items').update({ status: 'borrowed' }).eq('id', item.id)
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
            <div className="max-w-md mx-auto mt-12">
                <Card className="backdrop-blur-xl bg-card/80 border-border/50 text-center">
                    <CardContent className="pt-8 pb-8 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                            <CheckCircle className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold">Peminjaman Berhasil!</h2>
                        <div className="p-4 rounded-xl bg-muted/50">
                            <p className="text-sm text-muted-foreground">Kode Peminjaman</p>
                            <p className="text-2xl font-mono font-bold mt-1">{loanResult.code}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {loanResult.count} barang berhasil dipinjam.
                            <br />Jatuh tempo: akhir hari ini.
                        </p>
                        <Button className="w-full" onClick={() => router.push('/borrower/dashboard')}>
                            Ke Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (cartItems.length === 0) {
        return (
            <div className="max-w-md mx-auto mt-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold">Keranjang Kosong</h2>
                <p className="text-muted-foreground">Tambahkan barang terlebih dahulu</p>
                <Button onClick={() => router.push('/borrower/borrow')}>
                    Pilih Barang
                </Button>
            </div>
        )
    }

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Checkout</h1>
                <p className="text-muted-foreground">Konfirmasi peminjaman barang</p>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="text-base">Barang yang Dipinjam ({cartItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {cartItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                        <Package className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.code} • {item.category_name}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                        <Label>Catatan (opsional)</Label>
                        <Textarea
                            placeholder="Tambahkan catatan untuk peminjaman ini..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-sm text-blue-400">
                            ⏰ Jatuh tempo: akhir hari ini ({new Date().toLocaleDateString('id-ID')})
                        </p>
                    </div>
                    <Button className="w-full" size="lg" onClick={handleCheckout} disabled={processing}>
                        {processing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Memproses...
                            </>
                        ) : (
                            `Proses Peminjaman (${cartItems.length} barang)`
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
