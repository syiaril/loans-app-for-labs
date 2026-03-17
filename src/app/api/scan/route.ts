import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Use service role to bypass RLS — public scan needs to read items regardless of auth
function createClient() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')
    const query = searchParams.get('query')

    const supabase = createClient()

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
            // Step 1: Find the unreturned loan_item
            const { data: loanItem } = await supabase
                .from('loan_items')
                .select('id, loan_id')
                .eq('item_id', item.id)
                .is('returned_at', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            // Step 2: Get loan + borrower profile
            if (loanItem) {
                const { data: loan } = await supabase
                    .from('loans')
                    .select('loan_code, borrowed_at, due_date, user_id')
                    .eq('id', loanItem.loan_id)
                    .single()

                if (loan) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('name, department')
                        .eq('id', loan.user_id)
                        .single()

                    borrower = {
                        loan_code: loan.loan_code,
                        borrowed_at: loan.borrowed_at,
                        due_date: loan.due_date,
                        user: profile || { name: 'Unknown', department: '' },
                    }
                }
            }
        }

        return NextResponse.json({ item, borrower })
    }

    if (query) {
        // Sanitize query: remove commas to prevent breaking Supabase .or() filter syntax
        const sanitizedQuery = query.replace(/,/g, ' ')
        
        const { data: items, error } = await supabase
            .from('items')
            .select(`*, category:categories(name)`)
            .or(`name.ilike.%${sanitizedQuery}%,code.ilike.%${sanitizedQuery}%,barcode.ilike.%${sanitizedQuery}%`)
            .eq('is_active', true)
            .limit(10)

        if (error) {
            console.error('Search error:', error)
            return NextResponse.json({ error: 'Gagal mencari barang' }, { status: 500 })
        }

        return NextResponse.json({ items })
    }

    // Recommendations: borrowed items first, then available items
    const recommendations = searchParams.get('recommendations')
    if (recommendations === 'true') {
        // Get borrowed items (most relevant for quick return)
        const { data: borrowedItems } = await supabase
            .from('items')
            .select('*, category:categories(name)')
            .eq('status', 'borrowed')
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(5)

        // Get some available items
        const { data: availableItems } = await supabase
            .from('items')
            .select('*, category:categories(name)')
            .eq('status', 'available')
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(8)

        const allItems = [
            ...(borrowedItems || []),
            ...(availableItems || []),
        ].slice(0, 12)

        return NextResponse.json({ items: allItems })
    }

    return NextResponse.json({ error: 'Parameter barcode atau query diperlukan' }, { status: 400 })
}
