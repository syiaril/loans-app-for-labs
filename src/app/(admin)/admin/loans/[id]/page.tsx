'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { STATUS_LABELS, STATUS_COLORS, CONDITION_LABELS, formatDateTime, formatDate } from '@/lib/utils'
import { ArrowLeft, Loader2, Check, X, Undo2, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Loan, LoanItem, Item, Profile } from '@/lib/types/database'

interface FullLoan extends Loan {
    user: Profile
    approver?: Profile
    loan_items: (LoanItem & { item: Item })[]
}

export default function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { profile: currentUser } = useAuth()
    const [loan, setLoan] = useState<FullLoan | null>(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [returnForms, setReturnForms] = useState<Record<number, { condition: string; note: string }>>({})
    const [newDueDate, setNewDueDate] = useState('')

    useEffect(() => { loadLoan() }, [id])

    async function loadLoan() {
        const supabase = createClient()
        const { data } = await supabase.from('loans')
            .select('*, user:profiles!loans_user_id_fkey(*), approver:profiles!loans_approved_by_fkey(*), loan_items(*, item:items(*))')
            .eq('id', id).single()
        setLoan(data as FullLoan)
        setLoading(false)
    }

    async function handleApprove() {
        setProcessing(true)
        const supabase = createClient()
        const now = new Date().toISOString()
        const dueDate = new Date()
        dueDate.setHours(23, 59, 59, 999)
        await supabase.from('loans').update({ status: 'borrowed', approved_by: currentUser?.id, borrowed_at: now, due_date: dueDate.toISOString().split('T')[0] }).eq('id', id)
        for (const li of loan!.loan_items) {
            await supabase.from('items').update({ status: 'borrowed' }).eq('id', li.item_id)
        }
        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'approve', model_type: 'loan', model_id: parseInt(id), description: `Menyetujui peminjaman ${loan?.loan_code}` })
        toast.success('Peminjaman disetujui')
        loadLoan()
        setProcessing(false)
    }

    async function handleCancel() {
        setProcessing(true)
        const supabase = createClient()
        await supabase.from('loans').update({ status: 'cancelled' }).eq('id', id)
        for (const li of loan!.loan_items) {
            if (!li.returned_at) await supabase.from('items').update({ status: 'available' }).eq('id', li.item_id)
        }
        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'update', model_type: 'loan', model_id: parseInt(id), description: `Membatalkan peminjaman ${loan?.loan_code}` })
        toast.success('Peminjaman dibatalkan')
        loadLoan()
        setProcessing(false)
    }

    async function handleReturnItem(li: LoanItem & { item: Item }) {
        const form = returnForms[li.id]
        if (!form) { setReturnForms(prev => ({ ...prev, [li.id]: { condition: 'good', note: '' } })); return }
        setProcessing(true)
        const supabase = createClient()
        const now = new Date().toISOString()
        await supabase.from('loan_items').update({ returned_at: now, condition_after: form.condition, condition_note: form.note || null }).eq('id', li.id)
        const newStatus = form.condition === 'lost' ? 'lost' : form.condition === 'damaged' ? 'maintenance' : 'available'
        await supabase.from('items').update({ status: newStatus }).eq('id', li.item_id)
        const unreturned = loan!.loan_items.filter(x => x.id !== li.id && !x.returned_at)
        if (unreturned.length === 0) {
            await supabase.from('loans').update({ status: 'returned', returned_at: now, returned_to: currentUser?.id }).eq('id', id)
        } else {
            await supabase.from('loans').update({ status: 'partial_return' }).eq('id', id)
        }
        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'return', model_type: 'item', model_id: li.item_id, description: `Pengembalian manual: ${li.item.name}` })
        toast.success(`${li.item.name} dikembalikan`)
        loadLoan()
        setProcessing(false)
    }

    async function handleExtendDue() {
        if (!newDueDate) { toast.error('Pilih tanggal baru'); return }
        const supabase = createClient()
        await supabase.from('loans').update({ due_date: newDueDate }).eq('id', id)
        await supabase.from('audit_logs').insert({ user_id: currentUser?.id, action: 'update', model_type: 'loan', model_id: parseInt(id), description: `Perpanjang jatuh tempo: ${newDueDate}` })
        toast.success('Jatuh tempo diperpanjang')
        loadLoan()
    }

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
    if (!loan) return <p className="text-center py-12 text-muted-foreground">Peminjaman tidak ditemukan</p>

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-4 h-4" /></Button>
                <div>
                    <h1 className="text-2xl font-bold">Detail Peminjaman</h1>
                    <code className="text-muted-foreground">{loan.loan_code}</code>
                </div>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`text-sm ${STATUS_COLORS[loan.status]}`}>{STATUS_LABELS[loan.status]}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-muted-foreground">Peminjam:</span> {loan.user?.name}</div>
                        <div><span className="text-muted-foreground">Departemen:</span> {loan.user?.department || '-'}</div>
                        <div><span className="text-muted-foreground">Tanggal Pinjam:</span> {loan.borrowed_at ? formatDateTime(loan.borrowed_at) : '-'}</div>
                        <div><span className="text-muted-foreground">Jatuh Tempo:</span> {loan.due_date ? formatDate(loan.due_date) : '-'}</div>
                        <div><span className="text-muted-foreground">Disetujui oleh:</span> {loan.approver?.name || '-'}</div>
                        <div><span className="text-muted-foreground">Dikembalikan:</span> {loan.returned_at ? formatDateTime(loan.returned_at) : '-'}</div>
                    </div>
                    {loan.notes && <div><span className="text-sm text-muted-foreground">Catatan:</span> <p className="text-sm">{loan.notes}</p></div>}
                </CardContent>
            </Card>

            {/* Actions */}
            {['pending', 'approved'].includes(loan.status) && (
                <div className="flex gap-2">
                    {loan.status === 'pending' && <Button onClick={handleApprove} disabled={processing}><Check className="w-4 h-4 mr-1" />Setujui</Button>}
                    <Button variant="destructive" onClick={handleCancel} disabled={processing}><X className="w-4 h-4 mr-1" />Batalkan</Button>
                </div>
            )}

            {['borrowed', 'partial_return', 'overdue'].includes(loan.status) && (
                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />Perpanjang Jatuh Tempo</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                            <Button onClick={handleExtendDue}>Perpanjang</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Items */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader><CardTitle className="text-base">Daftar Barang ({loan.loan_items.length})</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {loan.loan_items.map((li) => (
                            <div key={li.id} className={`p-3 rounded-lg border ${li.returned_at ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/30 border-border/30'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-sm">{li.item.name}</p>
                                        <p className="text-xs text-muted-foreground">{li.item.code} • Kondisi sebelum: {CONDITION_LABELS[li.condition_before]}</p>
                                    </div>
                                    {li.returned_at ? (
                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 text-xs">
                                            Kembali • {CONDITION_LABELS[li.condition_after || 'good']}
                                        </Badge>
                                    ) : null}
                                </div>
                                {!li.returned_at && ['borrowed', 'partial_return', 'overdue'].includes(loan.status) && (
                                    <div className="mt-2">
                                        {returnForms[li.id] ? (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div><Label className="text-xs">Kondisi</Label>
                                                        <Select value={returnForms[li.id].condition} onValueChange={(v) => setReturnForms(p => ({ ...p, [li.id]: { ...p[li.id], condition: v } }))}>
                                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                            <SelectContent>{Object.entries(CONDITION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div><Label className="text-xs">Catatan</Label>
                                                        <Textarea className="h-8 min-h-[32px] text-xs" value={returnForms[li.id].note} onChange={(e) => setReturnForms(p => ({ ...p, [li.id]: { ...p[li.id], note: e.target.value } }))} />
                                                    </div>
                                                </div>
                                                <Button size="sm" className="w-full" onClick={() => handleReturnItem(li)} disabled={processing}>
                                                    <Undo2 className="w-3 h-3 mr-1" />Kembalikan
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => setReturnForms(p => ({ ...p, [li.id]: { condition: 'good', note: '' } }))}>
                                                <Undo2 className="w-3 h-3 mr-1" />Proses Pengembalian
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
