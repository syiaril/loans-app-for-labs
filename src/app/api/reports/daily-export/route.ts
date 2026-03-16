import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import * as XLSX from 'xlsx'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const startOfDay = `${date}T00:00:00.000Z`
    const endOfDay = `${date}T23:59:59.999Z`

    // Fetch loans & returns
    const [loansRes, returnsRes] = await Promise.all([
        supabase.from('loans')
            .select('*, user:profiles!loans_user_id_fkey(name, department), loan_items(id, item:items(name))')
            .gte('created_at', startOfDay).lte('created_at', endOfDay)
            .order('created_at', { ascending: false }),
        supabase.from('loan_items')
            .select('id, returned_at, condition_after, item:items(name), loan:loans(loan_code)')
            .gte('returned_at', startOfDay).lte('returned_at', endOfDay)
            .order('returned_at', { ascending: false })
    ])

    const loans = loansRes.data || []
    const returns = returnsRes.data || []

    // Build workbook
    const wb = XLSX.utils.book_new()

    // Sheet 1: Peminjaman
    const loansRows = loans.map((l: any) => ({
        'Kode Pinjam': l.loan_code || '',
        'Peminjam': l.user?.name || '',
        'Departemen': l.user?.department || '',
        'Barang': (l.loan_items as any[])?.map((li: any) => li.item?.name).join(', ') || '',
        'Jumlah Item': l.loan_items?.length || 0,
        'Status': l.status,
        'Tanggal Pinjam': formatDateTime(l.created_at),
        'Batas Kembali': l.due_date ? formatDateTime(l.due_date) : '',
    }))

    const wsLoans = XLSX.utils.json_to_sheet(loansRows.length > 0 ? loansRows : [{ 'Info': 'Tidak ada peminjaman pada tanggal ini' }])
    wsLoans['!cols'] = [{ wch: 18 }, { wch: 25 }, { wch: 20 }, { wch: 35 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsLoans, 'Peminjaman')

    // Sheet 2: Pengembalian
    const returnsRows = returns.map((r: any) => ({
        'Nama Barang': r.item?.name || '',
        'Kode Pinjam': r.loan?.loan_code || '',
        'Kondisi Setelah': r.condition_after || 'good',
        'Waktu Kembali': formatDateTime(r.returned_at),
    }))

    const wsReturns = XLSX.utils.json_to_sheet(returnsRows.length > 0 ? returnsRows : [{ 'Info': 'Tidak ada pengembalian pada tanggal ini' }])
    wsReturns['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, wsReturns, 'Pengembalian')

    // Sheet 3: Ringkasan
    const summary = [
        { 'Keterangan': 'Tanggal Laporan', 'Nilai': date },
        { 'Keterangan': 'Total Peminjaman', 'Nilai': String(loans.length) },
        { 'Keterangan': 'Total Pengembalian', 'Nilai': String(returns.length) },
        { 'Keterangan': 'Total Item Dipinjam', 'Nilai': String(loans.reduce((a: number, l: any) => a + (l.loan_items?.length || 0), 0)) },
        { 'Keterangan': 'Total Item Dikembalikan', 'Nilai': String(returns.length) },
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summary)
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Laporan_Harian_${date}.xlsx"`,
        },
    })
}
