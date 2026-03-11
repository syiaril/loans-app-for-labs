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
    Printer, Search, CheckSquare, Square, Package,
    Loader2, ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

interface Item {
    id: number
    name: string
    code: string
    barcode: string
    category?: { name: string }
}

export default function BarcodePrintPage() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadItems()
    }, [])

    async function loadItems() {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('items')
            .select('id, name, code, barcode, category:categories(name)')
            .eq('is_active', true)
            .order('code', { ascending: true })

        if (!error && data) {
            setItems(data as unknown as Item[])
        }
        setLoading(false)
    }

    const filtered = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase()) ||
        item.barcode.toLowerCase().includes(search.toLowerCase())
    )

    function toggleItem(id: number) {
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
            setSelected(new Set(filtered.map(i => i.id)))
        }
    }

    const generateBarcodes = useCallback(() => {
        if (!printRef.current) return

        const selectedItems = items.filter(i => selected.has(i.id))
        if (selectedItems.length === 0) {
            toast.error('Pilih barang terlebih dahulu')
            return
        }

        // Build print HTML
        const barcodeHTML = selectedItems.map(item => {
            const canvas = document.createElement('canvas')
            try {
                JsBarcode(canvas, item.barcode, {
                    format: 'CODE128',
                    width: 2,
                    height: 50,
                    displayValue: true,
                    fontSize: 14,
                    margin: 5,
                })
            } catch {
                JsBarcode(canvas, item.barcode, {
                    format: 'CODE128',
                    width: 2,
                    height: 50,
                    displayValue: true,
                })
            }
            const dataURL = canvas.toDataURL('image/png')
            return `
                <div style="display:inline-block;border:1px dashed #ccc;padding:8px 12px;margin:4px;text-align:center;page-break-inside:avoid;width:200px;">
                    <div style="font-size:11px;font-weight:bold;margin-bottom:2px;">${item.name}</div>
                    <div style="font-size:9px;color:#666;margin-bottom:4px;">${item.code}</div>
                    <img src="${dataURL}" style="max-width:180px;height:auto;" />
                </div>
            `
        }).join('')

        // Open print window
        const printWindow = window.open('', '_blank', 'width=800,height=600')
        if (!printWindow) {
            toast.error('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.')
            return
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cetak Barcode - Pojok Lab</title>
                <style>
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none !important; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    h2 {
                        text-align: center;
                        margin-bottom: 20px;
                        font-size: 16px;
                    }
                    .barcodes {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: center;
                        gap: 8px;
                    }
                    .no-print {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .no-print button {
                        padding: 10px 30px;
                        font-size: 14px;
                        background: #2563eb;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        margin: 0 5px;
                    }
                    .no-print button:hover {
                        background: #1d4ed8;
                    }
                </style>
            </head>
            <body>
                <h2>Barcode Barang Lab Komputer RPL</h2>
                <div class="no-print">
                    <button onclick="window.print()">🖨️ Cetak</button>
                    <button onclick="window.close()">✖ Tutup</button>
                </div>
                <div class="barcodes">
                    ${barcodeHTML}
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
    }, [items, selected])

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/items">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Cetak Barcode</h1>
                    <p className="text-muted-foreground text-sm">
                        Pilih barang untuk generate dan cetak barcode
                    </p>
                </div>
            </div>

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Pilih Barang ({selected.size} dipilih)
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
                                onClick={generateBarcodes}
                                disabled={selected.size === 0}
                            >
                                <Printer className="w-4 h-4 mr-1" />
                                Cetak ({selected.size})
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama, kode, atau barcode..."
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
                            {filtered.map((item) => (
                                <div
                                    key={item.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selected.has(item.id)
                                            ? 'bg-primary/10 border border-primary/20'
                                            : 'hover:bg-muted/50'
                                        }`}
                                    onClick={() => toggleItem(item.id)}
                                >
                                    <Checkbox
                                        checked={selected.has(item.id)}
                                        className="pointer-events-none"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.code} • {item.category?.name || ''}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                        {item.barcode}
                                    </Badge>
                                </div>
                            ))}
                            {filtered.length === 0 && (
                                <p className="text-center text-sm text-muted-foreground py-8">
                                    Tidak ada barang ditemukan
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
