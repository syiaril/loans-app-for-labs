import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const [year, mon] = month.split('-').map(Number)

    const supabase = await createClient()
    const startDate = new Date(year, mon - 1, 1).toISOString()
    const endDate = new Date(year, mon, 0, 23, 59, 59).toISOString()

    const { data: loans } = await supabase.from('loans')
        .select('*, user:profiles(name, role), loan_items(item:items(name))')
        .gte('created_at', startDate).lte('created_at', endDate)
        .order('created_at')

    const rows = [['Tanggal', 'Kode Pinjam', 'Peminjam', 'Role', 'Barang', 'Jumlah', 'Status', 'Jatuh Tempo', 'Dikembalikan'].join(',')]

    loans?.forEach(loan => {
        const user = loan.user as { name: string; role: string }
        const items = (loan.loan_items as { item: { name: string } }[])?.map(li => li.item?.name).join('; ')
        const itemCount = (loan.loan_items as unknown[])?.length || 0
        rows.push([
            new Date(loan.created_at).toLocaleDateString('id-ID'),
            loan.loan_code, user?.name || '', user?.role || '', `"${items}"`,
            itemCount, loan.status, loan.due_date || '', loan.returned_at ? new Date(loan.returned_at).toLocaleDateString('id-ID') : ''
        ].join(','))
    })

    const csv = rows.join('\n')
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="laporan-bulanan-${month}.csv"`,
        },
    })
}
