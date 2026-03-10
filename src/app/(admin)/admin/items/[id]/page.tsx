import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ITEM_STATUS_LABELS, ITEM_STATUS_COLORS, CONDITION_LABELS, formatDateTime } from '@/lib/utils'
import { Package } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const { data: item } = await supabase.from('items').select('*, category:categories(name)').eq('id', id).single()
    if (!item) notFound()

    const { data: loanHistory } = await supabase
        .from('loan_items')
        .select('*, loan:loans(loan_code, status, borrowed_at, user:profiles(name))')
        .eq('item_id', id).order('created_at', { ascending: false }).limit(10)

    const { count: totalLoans } = await supabase.from('loan_items').select('*', { count: 'exact', head: true }).eq('item_id', id)

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Detail Barang</h1>
                <Link href={`/admin/items/${id}/edit`}><Button size="sm">Edit</Button></Link>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center">
                            <Package className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold">{item.name}</h2>
                            <p className="text-muted-foreground">{item.code} • {(item.category as { name: string })?.name}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={ITEM_STATUS_COLORS[item.status]}>{ITEM_STATUS_LABELS[item.status]}</Badge>
                                <Badge variant="secondary">{CONDITION_LABELS[item.condition] || item.condition}</Badge>
                            </div>
                            {item.description && <p className="text-sm mt-3">{item.description}</p>}
                            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                                <div><span className="text-muted-foreground">Barcode:</span> <code>{item.barcode}</code></div>
                                <div><span className="text-muted-foreground">Lokasi:</span> {item.location || '-'}</div>
                                <div><span className="text-muted-foreground">Total Dipinjam:</span> {totalLoans} kali</div>
                                <div><span className="text-muted-foreground">Status:</span> {item.is_active ? 'Aktif' : 'Tidak Aktif'}</div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader><CardTitle className="text-base">Riwayat Peminjaman (10 Terakhir)</CardTitle></CardHeader>
                <CardContent>
                    {(!loanHistory || loanHistory.length === 0) ? (
                        <p className="text-muted-foreground text-center py-4">Belum ada riwayat</p>
                    ) : (
                        <div className="space-y-2">
                            {loanHistory.map((li) => {
                                const loan = li.loan as { loan_code: string; status: string; borrowed_at: string; user: { name: string } }
                                return (
                                    <div key={li.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                                        <div>
                                            <code className="text-xs">{loan?.loan_code}</code>
                                            <p className="text-xs text-muted-foreground">{loan?.user?.name}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{loan?.borrowed_at ? formatDateTime(loan.borrowed_at) : '-'}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
