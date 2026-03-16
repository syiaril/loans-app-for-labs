import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import * as XLSX from 'xlsx'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const [year, mon] = month.split('-').map(Number)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const startDate = new Date(year, mon - 1, 1).toISOString()
    const endDate = new Date(year, mon, 0, 23, 59, 59).toISOString()

    const { data: loans } = await supabase.from('loans')
        .select('*, user:profiles!loans_user_id_fkey(name, department), loan_items(id, item:items(name))')
        .gte('created_at', startDate).lte('created_at', endDate)
        .order('created_at')

    const loansData = loans || []

    // Build workbook
    const wb = XLSX.utils.book_new()

    // Sheet 1: Detail Peminjaman
    const detailRows = loansData.map((l: any) => ({
        'Tanggal': formatDateTime(l.created_at),
        'Kode Pinjam': l.loan_code || '',
        'Peminjam': l.user?.name || '',
        'Departemen': l.user?.department || '',
        'Barang': (l.loan_items as any[])?.map((li: any) => li.item?.name).join(', ') || '',
        'Jumlah Item': l.loan_items?.length || 0,
        'Status': l.status,
        'Batas Kembali': l.due_date ? formatDateTime(l.due_date) : '',
        'Tanggal Kembali': l.returned_at ? formatDateTime(l.returned_at) : '-',
    }))

    const wsDetail = XLSX.utils.json_to_sheet(detailRows.length > 0 ? detailRows : [{ 'Info': 'Tidak ada data peminjaman pada bulan ini' }])
    wsDetail['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 25 }, { wch: 20 }, { wch: 35 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Peminjaman')

    // Sheet 2: Ringkasan Statistik
    const totalItems = loansData.reduce((a: number, l: any) => a + ((l.loan_items as any[])?.length || 0), 0)
    const uniqueUsers = new Set(loansData.map((l: any) => l.user_id)).size
    const returnedCount = loansData.filter((l: any) => l.status === 'returned').length
    const overdueCount = loansData.filter((l: any) => l.status === 'overdue').length
    const borrowedCount = loansData.filter((l: any) => l.status === 'borrowed').length

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

    const summary = [
        { 'Keterangan': 'Periode', 'Nilai': `${monthNames[mon - 1]} ${year}` },
        { 'Keterangan': 'Total Peminjaman', 'Nilai': String(loansData.length) },
        { 'Keterangan': 'Total Item Dipinjam', 'Nilai': String(totalItems) },
        { 'Keterangan': 'Peminjam Unik', 'Nilai': String(uniqueUsers) },
        { 'Keterangan': 'Masih Dipinjam', 'Nilai': String(borrowedCount) },
        { 'Keterangan': 'Sudah Dikembalikan', 'Nilai': String(returnedCount) },
        { 'Keterangan': 'Terlambat', 'Nilai': String(overdueCount) },
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summary)
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

    // Sheet 3: Barang Populer
    const itemCounts: Record<string, number> = {}
    loansData.forEach((l: any) => {
        (l.loan_items as any[])?.forEach((li: any) => {
            const name = li.item?.name || 'Unknown'
            itemCounts[name] = (itemCounts[name] || 0) + 1
        })
    })
    const popularRows = Object.entries(itemCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count], i) => ({ 'No': i + 1, 'Nama Barang': name, 'Jumlah Dipinjam': count }))

    const wsPopular = XLSX.utils.json_to_sheet(popularRows.length > 0 ? popularRows : [{ 'Info': 'Belum ada data' }])
    wsPopular['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsPopular, 'Barang Populer')

    // Sheet 4: Peminjam Aktif
    const borrowerCounts: Record<string, number> = {}
    loansData.forEach((l: any) => {
        const name = (l.user as any)?.name || 'Unknown'
        borrowerCounts[name] = (borrowerCounts[name] || 0) + 1
    })
    const borrowerRows = Object.entries(borrowerCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count], i) => ({ 'No': i + 1, 'Nama Peminjam': name, 'Jumlah Pinjam': count }))

    const wsBorrowers = XLSX.utils.json_to_sheet(borrowerRows.length > 0 ? borrowerRows : [{ 'Info': 'Belum ada data' }])
    wsBorrowers['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsBorrowers, 'Peminjam Aktif')

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Laporan_Bulanan_${monthNames[mon - 1]}_${year}.xlsx"`,
        },
    })
}
