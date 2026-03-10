import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const supabase = await createClient()
    const startOfDay = `${date}T00:00:00.000Z`
    const endOfDay = `${date}T23:59:59.999Z`

    const { data: loans } = await supabase.from('loans')
        .select('*, user:profiles(name, role), loan_items(item:items(name))')
        .gte('created_at', startOfDay).lte('created_at', endOfDay)
        .order('created_at')

    const rows = [['Kode Pinjam', 'Peminjam', 'Barang', 'Jumlah', 'Status', 'Waktu Pinjam', 'Jatuh Tempo'].join(',')]

    loans?.forEach(loan => {
        const user = loan.user as { name: string }
        const items = (loan.loan_items as { item: { name: string } }[])?.map(li => li.item?.name).join('; ')
        const itemCount = (loan.loan_items as unknown[])?.length || 0
        rows.push([
            loan.loan_code, user?.name || '', `"${items}"`, itemCount,
            loan.status, loan.borrowed_at || loan.created_at, loan.due_date || ''
        ].join(','))
    })

    const csv = rows.join('\n')
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="laporan-harian-${date}.csv"`,
        },
    })
}
