'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import BarcodeScanner from '@/components/scanner/barcode-scanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { STATUS_LABELS, STATUS_COLORS, CONDITION_LABELS, formatDate } from '@/lib/utils'
import { Undo2, Package, Loader2, CheckCircle } from 'lucide-react'
import type { Loan, LoanItem, Item } from '@/lib/types/database'

interface ActiveLoan extends Loan {
    loan_items: (LoanItem & { item: Item })[]
}

export default function ReturnPage() {
    const { user } = useAuth()
    const [loans, setLoans] = useState<ActiveLoan[]>([])
    const [loading, setLoading] = useState(true)
    const [returnForms, setReturnForms] = useState<Record<number, { condition: string; note: string }>>({})
    const [processing, setProcessing] = useState<number | null>(null)

    const [refreshSignal, setRefreshSignal] = useState(0)

    const supabase = createClient()

    useEffect(() => {
        let isMounted = true

        async function loadLoans() {
            if (!user) return
            setLoading(true)
            const { data, error } = await supabase
                .from('loans')
                .select(`*, loan_items(*, item:items(*))`)
                .eq('user_id', user.id)
                .in('status', ['borrowed', 'partial_return', 'overdue', 'approved'])
                .order('created_at', { ascending: false })
            
            if (!isMounted) return

            if (data && !error) {
                setLoans((data as ActiveLoan[]) || [])
            }
            setLoading(false)
        }

        loadLoans()
        return () => { isMounted = false }
    }, [user, refreshSignal])

    const refresh = () => setRefreshSignal(s => s + 1)

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

        // Update loan_item
        await supabase
            .from('loan_items')
            .update({
                returned_at: now,
                condition_after: form.condition,
                condition_note: form.note || null,
            })
            .eq('id', loanItem.id)

        // Update item status
        const newStatus = form.condition === 'lost' ? 'lost' : form.condition === 'damaged' ? 'maintenance' : 'available'
        await supabase.from('items').update({
            status: newStatus,
            condition: form.condition === 'damaged' ? 'poor' : form.condition === 'lost' ? 'poor' : form.condition
        }).eq('id', loanItem.item_id)

        // Check if all items in this loan are returned
        const loan = loans.find(l => l.id === loanId)
        if (loan) {
            const unreturned = loan.loan_items.filter(
                li => li.id !== loanItem.id && !li.returned_at
            )
            if (unreturned.length === 0) {
                await supabase.from('loans').update({ status: 'returned', returned_at: now }).eq('id', loanId)
            } else {
                await supabase.from('loans').update({ status: 'partial_return' }).eq('id', loanId)
            }
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            user_id: user!.id,
            action: 'return',
            model_type: 'item',
            model_id: loanItem.item_id,
            description: `Pengembalian: ${loanItem.item.name} - Kondisi: ${CONDITION_LABELS[form.condition]}`,
        })

        toast.success(`${loanItem.item.name} berhasil dikembalikan`)
        setProcessing(null)
        refresh()
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
            {loans.length === 0 ? (
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
                                                <div className="space-y-2 mt-3">
                                                    {returnForms[li.id] ? (
                                                        <>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="space-y-1">
                                                                    <Label className="text-xs">Kondisi Setelah</Label>
                                                                    <Select
                                                                        value={returnForms[li.id].condition}
                                                                        onValueChange={(v) => setReturnForms(prev => ({
                                                                            ...prev,
                                                                            [li.id]: { ...prev[li.id], condition: v }
                                                                        }))}
                                                                    >
                                                                        <SelectTrigger className="h-8">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                                                                                <SelectItem key={k} value={k}>{v}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-xs">Catatan</Label>
                                                                    <Textarea
                                                                        placeholder="Opsional..."
                                                                        className="h-8 min-h-[32px] text-xs"
                                                                        value={returnForms[li.id].note}
                                                                        onChange={(e) => setReturnForms(prev => ({
                                                                            ...prev,
                                                                            [li.id]: { ...prev[li.id], note: e.target.value }
                                                                        }))}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                className="w-full"
                                                                onClick={() => handleReturnItem(li, loan.id)}
                                                                disabled={processing === li.id}
                                                            >
                                                                {processing === li.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                                ) : (
                                                                    <Undo2 className="w-3 h-3 mr-1" />
                                                                )}
                                                                Kembalikan
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full"
                                                            onClick={() => setReturnForms(prev => ({
                                                                ...prev,
                                                                [li.id]: { condition: 'good', note: '' }
                                                            }))}
                                                        >
                                                            <Undo2 className="w-3 h-3 mr-1" />
                                                            Kembalikan Item Ini
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
