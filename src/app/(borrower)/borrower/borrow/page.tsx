'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/hooks/use-cart'
import BarcodeScanner from '@/components/scanner/barcode-scanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ITEM_STATUS_LABELS, ITEM_STATUS_COLORS } from '@/lib/utils'
import { Package, ShoppingCart, Trash2, Search, ArrowRight, Loader2 } from 'lucide-react'
import type { Item, Category } from '@/lib/types/database'

export default function BorrowPage() {
    const router = useRouter()
    const { items: cartItems, addItem, removeItem, isInCart } = useCart()
    const [items, setItems] = useState<(Item & { category?: Category })[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [showCart, setShowCart] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        let isMounted = true

        async function loadData() {
            setLoading(true)
            const [{ data: itemsData }, { data: catsData }] = await Promise.all([
                supabase.from('items').select('*, category:categories(*)').eq('is_active', true).order('name'),
                supabase.from('categories').select('*').eq('is_active', true).order('name'),
            ])
            
            if (!isMounted) return

            setItems(itemsData || [])
            setCategories(catsData || [])
            setLoading(false)
        }

        loadData()
        return () => { isMounted = false }
    }, [])

    async function handleScan(barcode: string) {
        const res = await fetch(`/api/scan?barcode=${encodeURIComponent(barcode)}`)
        const data = await res.json()
        if (!res.ok) {
            toast.error(data.error || 'Barang tidak ditemukan')
            return
        }
        if (data.item.status !== 'available') {
            toast.error(`${data.item.name} sedang tidak tersedia (${ITEM_STATUS_LABELS[data.item.status]})`)
            return
        }
        if (isInCart(data.item.id)) {
            toast.info('Barang sudah ada di keranjang')
            return
        }
        addItem({
            id: data.item.id,
            name: data.item.name,
            code: data.item.code,
            barcode: data.item.barcode,
            category_name: data.item.category?.name || '',
            image: data.item.image,
        })
        toast.success(`${data.item.name} ditambahkan ke keranjang`)
    }

    const filteredItems = items.filter((item) => {
        const matchCategory = !selectedCategory || item.category_id === selectedCategory
        const matchSearch = !searchQuery ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code.toLowerCase().includes(searchQuery.toLowerCase())
        return matchCategory && matchSearch
    })

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Pinjam Barang</h1>
                <p className="text-muted-foreground">Scan barcode atau pilih dari katalog</p>
            </div>

            {/* Scanner */}
            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <CardTitle className="text-base">Scan Barcode</CardTitle>
                </CardHeader>
                <CardContent>
                    <BarcodeScanner onScan={handleScan} placeholder="Scan barcode barang..." />
                </CardContent>
            </Card>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari barang..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <Button
                        variant={!selectedCategory ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(null)}
                    >
                        Semua
                    </Button>
                    {categories.map((cat) => (
                        <Button
                            key={cat.id}
                            variant={selectedCategory === cat.id ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory(cat.id)}
                            className="whitespace-nowrap"
                        >
                            {cat.name}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Items Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map((item) => (
                        <Card key={item.id} className="backdrop-blur-xl bg-card/80 border-border/50 hover:border-primary/30 transition-all duration-200">
                            <CardContent className="pt-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <Package className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-sm truncate">{item.name}</h3>
                                        <p className="text-xs text-muted-foreground">{item.code} • {item.category?.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className={`text-xs ${ITEM_STATUS_COLORS[item.status]}`}>
                                                {ITEM_STATUS_LABELS[item.status]}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    {item.status === 'available' ? (
                                        isInCart(item.id) ? (
                                            <Button variant="outline" size="sm" className="w-full" disabled>
                                                ✓ Di Keranjang
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className="w-full"
                                                onClick={() => {
                                                    addItem({
                                                        id: item.id,
                                                        name: item.name,
                                                        code: item.code,
                                                        barcode: item.barcode,
                                                        category_name: item.category?.name || '',
                                                        image: item.image,
                                                    })
                                                    toast.success(`${item.name} ditambahkan`)
                                                }}
                                            >
                                                <ShoppingCart className="w-3 h-3 mr-1" />
                                                Tambah
                                            </Button>
                                        )
                                    ) : (
                                        <Button variant="outline" size="sm" className="w-full" disabled>
                                            Tidak Tersedia
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {filteredItems.length === 0 && !loading && (
                <p className="text-center text-muted-foreground py-8">Tidak ada barang ditemukan</p>
            )}

            {/* Cart Bar */}
            {cartItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" onClick={() => setShowCart(!showCart)}>
                                <ShoppingCart className="w-4 h-4 mr-1" />
                                {cartItems.length} barang
                            </Button>
                            {showCart && (
                                <div className="flex gap-1 overflow-x-auto max-w-[50vw]">
                                    {cartItems.map((item) => (
                                        <Badge key={item.id} variant="secondary" className="shrink-0 gap-1">
                                            {item.name}
                                            <button onClick={() => removeItem(item.id)}>
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button onClick={() => router.push('/borrower/checkout')}>
                            Checkout
                            <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
