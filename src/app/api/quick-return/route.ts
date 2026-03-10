import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

// Use service role to bypass RLS — this is safe because it only runs server-side
function createServiceClient() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function POST(request: Request) {
    const { barcode, pin } = await request.json()

    if (!barcode) {
        return NextResponse.json({ error: 'Barcode diperlukan' }, { status: 400 })
    }

    const supabase = createServiceClient()

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

    // Find active loan_item with borrower info
    const { data: loanItem, error: liError } = await supabase
        .from('loan_items')
        .select(`
            id, loan_id,
            loan:loans(id, loan_code, user_id, status)
        `)
        .eq('item_id', item.id)
        .is('returned_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (liError || !loanItem) {
        return NextResponse.json({ error: 'Data peminjaman tidak ditemukan' }, { status: 404 })
    }

    const loan = Array.isArray(loanItem.loan) ? loanItem.loan[0] : loanItem.loan

    if (!loan) {
        return NextResponse.json({ error: 'Data peminjaman tidak valid' }, { status: 404 })
    }

    // Check PIN verification - look up the borrower's profile
    const { data: borrowerProfile } = await supabase
        .from('profiles')
        .select('id, name, pin')
        .eq('id', loan.user_id)
        .single()

    if (!borrowerProfile) {
        return NextResponse.json({ error: 'Profil peminjam tidak ditemukan' }, { status: 404 })
    }

    // If borrower has a PIN set, require it
    if (borrowerProfile.pin) {
        if (!pin) {
            return NextResponse.json({
                error: 'PIN diperlukan untuk verifikasi',
                requires_pin: true,
                borrower_name: borrowerProfile.name,
            }, { status: 403 })
        }
        if (pin !== borrowerProfile.pin) {
            return NextResponse.json({
                error: 'PIN salah! Silakan coba lagi.',
                requires_pin: true,
            }, { status: 403 })
        }
    }

    const now = new Date().toISOString()

    // Update loan_item: mark as returned
    await supabase
        .from('loan_items')
        .update({
            returned_at: now,
            condition_after: 'good',
            condition_note: 'Quick return dari halaman scan publik',
        })
        .eq('id', loanItem.id)

    // Update item status to available
    await supabase
        .from('items')
        .update({ status: 'available' })
        .eq('id', item.id)

    // Check if all loan_items in this loan are returned
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

    // Audit log
    await supabase.from('audit_logs').insert({
        user_id: borrowerProfile.id,
        action: 'return',
        model_type: 'item',
        model_id: item.id,
        description: `Quick return: ${item.name} (${item.code}) oleh ${borrowerProfile.name}`,
    })

    return NextResponse.json({
        success: true,
        message: `${item.name} berhasil dikembalikan oleh ${borrowerProfile.name}`,
        item_name: item.name,
        borrower_name: borrowerProfile.name,
    })
}
