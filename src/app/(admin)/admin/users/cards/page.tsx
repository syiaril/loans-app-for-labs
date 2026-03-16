'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import JsBarcode from 'jsbarcode'
import {
    Printer, Search, CheckSquare, Square, Users,
    Loader2, ArrowLeft, User
} from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/lib/types/database'

export default function UserCardsPrintPage() {
    const [users, setUsers] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadUsers()
    }, [])

    async function loadUsers() {
        const supabase = createClient()
        // Ambil semua user yang sudah di-approve
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('is_approved', true)
            .order('name', { ascending: true })

        if (!error && data) {
            setUsers(data)
        }
        setLoading(false)
    }

    const filtered = users.filter(user =>
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(search.toLowerCase())) ||
        (user.card_barcode && user.card_barcode.toLowerCase().includes(search.toLowerCase())) ||
        (user.department && user.department.toLowerCase().includes(search.toLowerCase()))
    )

    function toggleUser(id: string) {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function selectAll() {
        if (selected.size === filtered.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(filtered.map(u => u.id)))
        }
    }

    const generateCards = useCallback(() => {
        if (!printRef.current) return

        const selectedUsers = users.filter(u => selected.has(u.id))
        if (selectedUsers.length === 0) {
            toast.error('Pilih pengguna terlebih dahulu')
            return
        }

        const supabase = createClient()
        // Build print HTML
        const cardsHTML = selectedUsers.map(user => {
            // Generate barcode image data URL
            const barcodeValue = user.card_barcode || user.id.substring(0, 12)
            const canvas = document.createElement('canvas')
            try {
                JsBarcode(canvas, barcodeValue, {
                    format: 'CODE128',
                    width: 2,
                    height: 40,
                    displayValue: false, // Kita buat display value sendiri supaya font lebih rapi
                    margin: 0,
                })
            } catch {
                JsBarcode(canvas, barcodeValue, {
                    format: 'CODE128',
                    width: 2,
                    height: 40,
                    displayValue: false,
                })
            }
            const barcodeDataURL = canvas.toDataURL('image/png')

            // Data untuk di kartu
            const nomor = barcodeValue
            const nama = user.name.toUpperCase()
            const jenis = user.role === 'admin' ? 'Admin / Petugas' : 'Pelajar'
            const lokasi = 'Laboratorium Pojok RPL'
            
            // Tanggal berlaku (misal 3 tahun dari tanggal pembuatan)
            const createdDate = new Date(user.created_at)
            const expiryDate = new Date(createdDate.setFullYear(createdDate.getFullYear() + 3))
            const expiryStr = expiryDate.toLocaleDateString('id-ID', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            }).replace(/\//g, '-')

            return `
                <div class="card">
                    <!-- Background shapes -->
                    <div class="card-bg"></div>
                    <div class="card-bg-bottom"></div>
                    
                    <div class="card-content">
                        <!-- Header -->
                        <div class="header">
                            <div class="logo-box">
                                <img src="https://skensa-rpl.com/images/logo_rpl.png" alt="Logo RPL" style="width: 100%; height: 100%; object-fit: contain;" />
                            </div>
                            <div class="header-text">
                                <div class="title">Kartu Anggota</div>
                                <div class="subtitle">Laboratorium Pojok RPL</div>
                                <div class="address">Jl. Veteran 11 Kota Pasuruan</div>
                            </div>
                        </div>

                        <!-- Body -->
                        <div class="body-section">
                            <!-- Photo -->
                            <div class="photo-container">
                                ${user.photo ? 
                                    `<img src="${supabase.storage.from('profiles').getPublicUrl(user.photo).data.publicUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` 
                                    : 
                                    `<div class="photo-placeholder">
                                        <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>`
                                }
                            </div>

                            <!-- User Data -->
                            <table class="user-data">
                                <tr>
                                    <td class="label">Nomor</td>
                                    <td class="separator">:</td>
                                    <td class="value">${nomor}</td>
                                </tr>
                                <tr>
                                    <td class="label">Nama</td>
                                    <td class="separator">:</td>
                                    <td class="value font-bold">${nama}</td>
                                </tr>
                                <tr>
                                    <td class="label">Jenis</td>
                                    <td class="separator">:</td>
                                    <td class="value">${jenis}</td>
                                </tr>
                                <tr>
                                    <td class="label">Lokasi</td>
                                    <td class="separator">:</td>
                                    <td class="value">${lokasi}</td>
                                </tr>
                                <tr>
                                    <td class="label">Berlaku</td>
                                    <td class="separator">:</td>
                                    <td class="value">Hingga ${expiryStr}</td>
                                </tr>
                            </table>
                        </div>

                        <!-- Barcode Area -->
                        <div class="barcode-area">
                            <img src="${barcodeDataURL}" class="barcode-img" />
                            <div class="barcode-text">${barcodeValue}</div>
                        </div>
                    </div>
                </div>
            `
        }).join('')

        // Open print window
        const printWindow = window.open('', '_blank', 'width=900,height=700')
        if (!printWindow) {
            toast.error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.')
            return
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cetak Kartu Anggota - Pojok Lab</title>
                <style>
                    * {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    @media print {
                        body { margin: 0; padding: 0; background: white; }
                        .no-print { display: none !important; }
                        @page { size: A4; margin: 10mm; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        background: #f1f5f9;
                    }
                    .controls {
                        background: white;
                        padding: 15px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                        text-align: center;
                    }
                    .controls h2 {
                        margin-top: 0;
                        margin-bottom: 15px;
                        font-size: 18px;
                        color: #0f172a;
                    }
                    .controls button {
                        padding: 10px 24px;
                        font-size: 14px;
                        font-weight: bold;
                        background: #8b5cf6; /* Purple theme */
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        margin: 0 5px;
                        transition: background 0.2s;
                    }
                    .controls button:hover { background: #7c3aed; }
                    .controls button.secondary { background: #64748b; }
                    .controls button.secondary:hover { background: #475569; }
                    
                    /* Kartu ID Styles */
                    .cards-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 15px;
                        justify-content: center;
                    }
                    
                    .card {
                        position: relative;
                        width: 8.5cm;
                        min-height: 5.4cm;
                        background: white;
                        border: 1px solid #cbd5e1;
                        border-radius: 8px;
                        overflow: hidden;
                        page-break-inside: avoid;
                        margin-bottom: 10px;
                    }

                    .card-bg {
                        position: absolute;
                        top: 0; left: 0;
                        width: 100%; height: 38px;
                        background: linear-gradient(135deg, #eaddf8 0%, #f3e8ff 100%);
                        border-bottom: 3px solid #d8b4fe;
                        z-index: 0;
                    }

                    .card-bg-bottom {
                        position: absolute;
                        bottom: 0; left: 0;
                        width: 100%; height: 50px;
                        clip-path: polygon(0 20%, 30% 0, 70% 30%, 100% 10%, 100% 100%, 0 100%);
                        background: linear-gradient(to right, #e0f2fe, #f3e8ff);
                        opacity: 0.8;
                        z-index: 0;
                    }

                    .card-content {
                        position: relative;
                        z-index: 1;
                        padding: 6px 12px 6px;
                    }

                    /* Header */
                    .header {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 6px;
                    }
                    .logo-box {
                        width: 26px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .header-text { flex: 1; }
                    .title {
                        font-size: 11px;
                        font-weight: bold;
                        color: #1e293b;
                        line-height: 1.2;
                    }
                    .subtitle {
                        font-size: 10px;
                        color: #334155;
                        font-weight: 600;
                        line-height: 1.2;
                    }
                    .address {
                        font-size: 7px;
                        color: #64748b;
                        margin-top: 1px;
                    }

                    /* Body Section */
                    .body-section {
                        display: flex;
                        gap: 8px;
                        margin-bottom: 4px;
                    }
                    .photo-container {
                        width: 1.8cm;
                        height: 2.2cm;
                        border: 1px solid #94a3b8;
                        background: #f1f5f9;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #cbd5e1;
                        overflow: hidden;
                        flex-shrink: 0;
                    }
                    .photo-placeholder { color: #94a3b8; }
                    
                    .user-data {
                        flex: 1;
                        font-size: 8.5px;
                        border-collapse: collapse;
                    }
                    .user-data td {
                        padding: 1px 0;
                        vertical-align: top;
                        color: #0f172a;
                    }
                    .user-data .label {
                        width: 42px;
                        color: #475569;
                    }
                    .user-data .separator {
                        width: 8px;
                        text-align: center;
                    }
                    .user-data .font-bold {
                        font-weight: bold;
                        font-size: 9px;
                        text-transform: uppercase;
                    }

                    /* Barcode Area */
                    .barcode-area {
                        text-align: center;
                        padding: 2px 0 4px;
                    }
                    .barcode-img {
                        height: 32px;
                        width: auto;
                        max-width: 100%;
                    }
                    .barcode-text {
                        font-size: 8px;
                        font-weight: bold;
                        letter-spacing: 1px;
                        color: #0f172a;
                        margin-top: -1px;
                    }
                </style>
            </head>
            <body>
                <div class="controls no-print">
                    <h2>Cetak Kartu Anggota Perpustakaan / Lab</h2>
                    <p style="font-size:13px; color:#64748b; margin-top:-10px; margin-bottom:15px;">Setingan Cetak: Kertas A4, Orientasi Potrait, Skala 100%, Margins Minimal/None, Pastikan "Print Background Graphics" AKTIF.</p>
                    <button onclick="window.print()">🖨️ Cetak Kartu</button>
                    <button class="secondary" onclick="window.close()">✖ Tutup</button>
                </div>
                <div class="cards-container">
                    ${cardsHTML}
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
    }, [users, selected])

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/users">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Cetak Kartu Anggota</h1>
                    <p className="text-muted-foreground text-sm">
                        Pilih pengguna untuk dbuatkan dan cetak kartu ID
                    </p>
                </div>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Pilih Pengguna ({selected.size} dipilih)
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={selectAll}
                            >
                                {selected.size === filtered.length ? (
                                    <><Square className="w-4 h-4 mr-1" /> Batal Pilih</>
                                ) : (
                                    <><CheckSquare className="w-4 h-4 mr-1" /> Pilih Semua</>
                                )}
                            </Button>
                            <Button
                                size="sm"
                                onClick={generateCards}
                                disabled={selected.size === 0}
                            >
                                <Printer className="w-4 h-4 mr-1" />
                                Cetak Kartu ({selected.size})
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama, email, jurusan, atau barcode..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-1 max-h-[500px] overflow-y-auto">
                            {filtered.map((user) => (
                                <div
                                    key={user.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selected.has(user.id)
                                            ? 'bg-primary/10 border border-primary/20'
                                            : 'hover:bg-muted/50'
                                        }`}
                                    onClick={() => toggleUser(user.id)}
                                >
                                    <Checkbox
                                        checked={selected.has(user.id)}
                                        className="pointer-events-none"
                                    />
                                    <div className="flex flex-1 items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{user.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {user.email} • {user.department || user.role}
                                            </p>
                                        </div>
                                    </div>
                                    {user.card_barcode ? (
                                        <Badge variant="outline" className="text-[10px] font-mono whitespace-nowrap">
                                            {user.card_barcode}
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                                            Barcode Auto
                                        </Badge>
                                    )}
                                </div>
                            ))}
                            {filtered.length === 0 && (
                                <p className="text-center text-sm text-muted-foreground py-8">
                                    Tidak ada pengguna ditemukan
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div ref={printRef} className="hidden" />
        </div>
    )
}
