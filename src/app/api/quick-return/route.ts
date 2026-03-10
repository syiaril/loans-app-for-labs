import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    const { barcode } = await request.json()

    if (!barcode) {
        return NextResponse.json({ error: 'Barcode diperlukan' }, { status: 400 })
    }

    const supabase = await createClient()

    // Find item
    const { data: item, error: itemError } = await supabase
        .from('items')
        .select('id, name, code, status')
        .eq('barcode', barcode)
        .single()

    if (itemError || !item) {
        return NextResponse.json({ error: 'Barang tidak ditemukan' }, { status: 404 })
    }

    if (item.status !== 'borrowed') {
        return NextResponse.json({ error: 'Barang tidak sedang dipinjam' }, { status: 400 })
    }

    // Find active loan_item
    const { data: loanItem, error: liError } = await supabase
        .from('loan_items')
        .select(`
      id, loan_id,
      loan:loans(id, loan_code, user_id, status, user:profiles(name))
    `)
        .eq('item_id', item.id)
        .is('returned_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (liError || !loanItem) {
        return NextResponse.json({ error: 'Data peminjaman tidak ditemukan' }, { status: 404 })
    }

    const now = new Date().toISOString()

    // Update loan_item: mark as returned
    await supabase
        .from('loan_items')
        .update({
            returned_at: now,
            condition_after: 'good',
            condition_note: 'Quick return dari halaman publik',
        })
        .eq('id', loanItem.id)

    // Update item status to available
    await supabase
        .from('items')
        .update({ status: 'available' })
        .eq('id', item.id)

    // Check if all loan_items in this loan are returned
    const loan = Array.isArray(loanItem.loan) ? loanItem.loan[0] : loanItem.loan
    if (loan) {
        const { data: unreturned } = await supabase
            .from('loan_items')
            .select('id')
            .eq('loan_id', loan.id)
            .is('returned_at', null)

        if (!unreturned || unreturned.length === 0) {
            await supabase
                .from('loans')
                .update({ status: 'returned', returned_at: now })
                .eq('id', loan.id)
        } else {
            await supabase
                .from('loans')
                .update({ status: 'partial_return' })
                .eq('id', loan.id)
        }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
        action: 'return',
        model_type: 'item',
        model_id: item.id,
        description: `Quick return: ${item.name} (${item.code}) - tanpa login`,
    })

    return NextResponse.json({
        success: true,
        message: `${item.name} berhasil dikembalikan`,
        item_name: item.name,
    })
}
