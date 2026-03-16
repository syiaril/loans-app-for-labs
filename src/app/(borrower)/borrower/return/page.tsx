'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import useSWR, { mutate } from 'swr'
import BarcodeScanner from '@/components/scanner/barcode-scanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { STATUS_LABELS, STATUS_COLORS, CONDITION_LABELS, formatDate, formatDateTime } from '@/lib/utils'
import { Undo2, Package, Loader2, CheckCircle } from 'lucide-react'
import type { Loan, LoanItem, Item } from '@/lib/types/database'
import { CardSkeleton } from '@/components/skeletons'

interface ActiveLoan extends Loan {
    loan_items: (LoanItem & { item: Item })[]
}

export default function ReturnPage() {
    const { user } = useAuth()
    const [processing, setProcessing] = useState<number | null>(null)
    const [returnForms, setReturnForms] = useState<Record<number, { condition: string; note: string }>>({})
    const supabase = createClient()

    // 1. Fetch active loans with SWR
    const { data: activeLoansData = [], isLoading: loansLoading } = useSWR(user ? ['returnable-loans', user.id] : null, async () => {
        const { data } = await supabase
            .from('loans')
            .select(`*, loan_items(*, item:items(*))`)
            .eq('user_id', user!.id)
            .in('status', ['borrowed', 'partial_return', 'overdue', 'approved'])
            .order('created_at', { ascending: false })
        return (data as ActiveLoan[]) || []
    }, {
        revalidateOnFocus: true
    })

    const loans = activeLoansData
    const loading = loansLoading && loans.length === 0

    async function handleScanReturn(barcode: string) {
        const supabase = createClient()
        // Find the item in active loans
        for (const loan of loans) {
            const loanItem = loan.loan_items.find(
                li => li.item.barcode === barcode && !li.returned_at
            )
            if (loanItem) {
                setReturnForms(prev => ({
                    ...prev,
                    [loanItem.id]: { condition: 'good', note: '' }
                }))
                toast.info(`${loanItem.item.name} ditemukan. Pilih kondisi dan kembalikan.`)
                return
            }
        }
        toast.error('Barang tidak ditemukan di peminjaman aktif Anda')
    }

    async function handleReturnItem(loanItem: LoanItem & { item: Item }, loanId: number) {
        const form = returnForms[loanItem.id]
        if (!form) {
            setReturnForms(prev => ({
                ...prev,
                [loanItem.id]: { condition: 'good', note: '' }
            }))
            return
        }

        setProcessing(loanItem.id)
        const supabase = createClient()
        const now = new Date().toISOString()

        try {
            // Update loan_item and item parallelly
            const newStatus = form.condition === 'lost' ? 'lost' : form.condition === 'damaged' ? 'maintenance' : 'available'
            const newCondition = form.condition === 'damaged' ? 'poor' : form.condition === 'lost' ? 'poor' : form.condition

            const updates: any[] = [
                supabase
                    .from('loan_items')
                    .update({
                        returned_at: now,
                        condition_after: form.condition,
                        condition_note: form.note || null,
                    })
                    .eq('id', loanItem.id),
                supabase
                    .from('items')
                    .update({
                        status: newStatus,
                        condition: newCondition
                    })
                    .eq('id', loanItem.item_id)
            ]

            // Check loan status update
            const loan = loans.find(l => l.id === loanId)
            if (loan) {
                const unreturned = loan.loan_items.filter(
                    li => li.id !== loanItem.id && !li.returned_at
                )
                if (unreturned.length === 0) {
                    updates.push(supabase.from('loans').update({ status: 'returned', returned_at: now }).eq('id', loanId))
                } else {
                    updates.push(supabase.from('loans').update({ status: 'partial_return' }).eq('id', loanId))
                }
            }

            // Audit log - don't strictly wait to finish but start it
            updates.push(supabase.from('audit_logs').insert({
                user_id: user!.id,
                action: 'return',
                model_type: 'item',
                model_id: loanItem.item_id,
                description: `Pengembalian: ${loanItem.item.name} - Kondisi: ${CONDITION_LABELS[form.condition]}`,
            }))

            await Promise.all(updates)

            toast.success(`${loanItem.item.name} berhasil dikembalikan`)
            
            // Invalidate caches
            mutate(['returnable-loans', user!.id])
            mutate(['activeLoans', user!.id])
            mutate(['recentLoans', user!.id])
            
        } catch (error) {
            console.error(error)
            toast.error('Gagal memproses pengembalian')
        } finally {
            setProcessing(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Pengembalian Barang</h1>
                <p className="text-muted-foreground">Scan atau pilih barang yang ingin dikembalikan</p>
            </div>

            {/* Scanner */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="text-base">Scan Barcode Barang</CardTitle>
                </CardHeader>
                <CardContent>
                    <BarcodeScanner onScan={handleScanReturn} placeholder="Scan barcode barang yang dikembalikan..." />
                </CardContent>
            </Card>

            {/* Active Loans */}
            {loading ? (
                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardContent className="p-6">
                        <CardSkeleton lines={3} />
                    </CardContent>
                </Card>
            ) : loans.length === 0 ? (
                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardContent className="py-12 text-center">
                        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                        <p className="text-muted-foreground">Tidak ada barang yang perlu dikembalikan</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {loans.map((loan) => (
                        <Card key={loan.id} className="backdrop-blur-xl bg-card/80 border-border/50">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{loan.loan_code}</code>
                                        <Badge variant="outline" className={STATUS_COLORS[loan.status]}>
                                            {STATUS_LABELS[loan.status]}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {loan.due_date && `Jatuh tempo: ${formatDate(loan.due_date)}`}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {loan.loan_items.map((li) => (
                                        <div key={li.id} className={`p-3 rounded-lg border ${li.returned_at ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/30 border-border/30'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Package className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium">{li.item.name}</span>
                                                    <span className="text-xs text-muted-foreground">{li.item.code}</span>
                                                </div>
                                                {li.returned_at ? (
                                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 text-xs">
                                                        Dikembalikan
                                                    </Badge>
                                                ) : null}
                                            </div>

                                             {!li.returned_at && (
                                                <div className="space-y-4 mt-5 pt-4 border-t border-border/40">
                                                    {returnForms[li.id] ? (
                                                        <div className="space-y-5">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Kondisi Barang</Label>
                                                                    <Select
                                                                        value={returnForms[li.id].condition}
                                                                        onValueChange={(v) => setReturnForms(prev => ({
                                                                            ...prev,
                                                                            [li.id]: { ...prev[li.id], condition: v }
                                                                        }))}
                                                                    >
                                                                        <SelectTrigger className="h-14 rounded-xl bg-background/50 border-border/60 text-base">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl">
                                                                            {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                                                                                <SelectItem key={k} value={k} className="h-12">{v}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Catatan Tambahan</Label>
                                                                    <Textarea
                                                                        placeholder="Tambahkan catatan jika ada kerusakan..."
                                                                        className="h-14 min-h-[56px] rounded-xl bg-background/50 border-border/60 text-base resize-none"
                                                                        value={returnForms[li.id].note}
                                                                        onChange={(e) => setReturnForms(prev => ({
                                                                            ...prev,
                                                                            [li.id]: { ...prev[li.id], note: e.target.value }
                                                                        }))}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Button
                                                                className="w-full h-14 rounded-xl text-base font-bold shadow-lg shadow-emerald-500/10 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all"
                                                                onClick={() => handleReturnItem(li, loan.id)}
                                                                disabled={processing === li.id}
                                                            >
                                                                {processing === li.id ? (
                                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                                                ) : (
                                                                    <Undo2 className="w-5 h-5 mr-3" />
                                                                )}
                                                                Konfirmasi Pengembalian
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            className="w-full h-14 rounded-xl border-dashed bg-muted/20 hover:bg-muted/40 transition-all font-semibold active:scale-[0.98]"
                                                            onClick={() => setReturnForms(prev => ({
                                                                ...prev,
                                                                [li.id]: { condition: 'good', note: '' }
                                                            }))}
                                                        >
                                                            <Undo2 className="w-5 h-5 mr-3 opacity-60" />
                                                            Pilih untuk Kembalikan
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
