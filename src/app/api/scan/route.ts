import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')
    const query = searchParams.get('query')

    const supabase = await createClient()

    if (barcode) {
        const { data: item, error } = await supabase
            .from('items')
            .select(`
        *,
        category:categories(name)
      `)
            .eq('barcode', barcode)
            .single()

        if (error || !item) {
            return NextResponse.json({ error: 'Barang tidak ditemukan' }, { status: 404 })
        }

        // If borrowed, get borrower info
        let borrower = null
        if (item.status === 'borrowed') {
            const { data: loanItem } = await supabase
                .from('loan_items')
                .select(`
          loan:loans(
            loan_code,
            borrowed_at,
            due_date,
            user:profiles(name, department)
          )
        `)
                .eq('item_id', item.id)
                .is('returned_at', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (loanItem?.loan) {
                borrower = loanItem.loan
            }
        }

        return NextResponse.json({ item, borrower })
    }

    if (query) {
        const { data: items, error } = await supabase
            .from('items')
            .select(`*, category:categories(name)`)
            .or(`name.ilike.%${query}%,code.ilike.%${query}%,barcode.ilike.%${query}%`)
            .eq('is_active', true)
            .limit(10)

        if (error) {
            return NextResponse.json({ error: 'Gagal mencari barang' }, { status: 500 })
        }

        return NextResponse.json({ items })
    }

    return NextResponse.json({ error: 'Parameter barcode atau query diperlukan' }, { status: 400 })
}
