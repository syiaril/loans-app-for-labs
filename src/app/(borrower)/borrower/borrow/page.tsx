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
import { Package, ShoppingCart, Trash2, Search, ArrowRight, Loader2, CheckCircle, XCircle } from 'lucide-react'
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
            <div className="flex flex-col gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama atau kode barang..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-14 pl-12 rounded-2xl text-base bg-card/50 border-border/60"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <Button
                        variant={!selectedCategory ? 'secondary' : 'outline'}
                        className="h-12 px-6 rounded-xl shrink-0 font-medium active:scale-95 transition-all"
                        onClick={() => setSelectedCategory(null)}
                    >
                        Semua
                    </Button>
                    {categories.map((cat) => (
                        <Button
                            key={cat.id}
                            variant={selectedCategory === cat.id ? 'secondary' : 'outline'}
                            className="h-12 px-6 rounded-xl shrink-0 font-medium whitespace-nowrap active:scale-95 transition-all"
                            onClick={() => setSelectedCategory(cat.id)}
                        >
                            {cat.name}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Items Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="backdrop-blur-xl bg-card/60 border-border/40 shadow-sm rounded-2xl overflow-hidden">
                            <CardContent className="p-0 animate-pulse">
                                <div className="p-5 flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-muted/60 shrink-0"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-muted/60 rounded w-3/4"></div>
                                        <div className="h-3 bg-muted/60 rounded w-1/2"></div>
                                        <div className="h-5 bg-muted/60 rounded w-1/4 mt-2"></div>
                                    </div>
                                    <div className="shrink-0 pl-4 border-l border-border/40 h-16 flex items-center">
                                        <div className="w-14 h-14 rounded-2xl bg-muted/60"></div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map((item) => (
                        <Card key={item.id} className="backdrop-blur-xl bg-card/60 border-border/40 hover:border-primary/40 transition-all duration-300 shadow-sm rounded-2xl overflow-hidden group">
                            <CardContent className="p-0">
                                <div className="p-5 flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center shrink-0 border border-border/40 shadow-inner group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                                        {item.image ? (
                                            <img
                                                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/items/${item.image}`}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <Package className="w-8 h-8 text-muted-foreground/50" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-base truncate">{item.name}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">{item.code} • {item.category?.name}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge variant="outline" className={`text-[10px] py-0 px-2 h-5 rounded-md ${ITEM_STATUS_COLORS[item.status]}`}>
                                                {ITEM_STATUS_LABELS[item.status]}
                                            </Badge>
                                        </div>
                                    </div>
                                    
                                    <div className="shrink-0 flex items-center justify-center border-l border-border/40 pl-4 h-16">
                                        {item.status === 'available' ? (
                                            isInCart(item.id) ? (
                                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-inner">
                                                     <CheckCircle className="w-7 h-7" />
                                                </div>
                                            ) : (
                                                <Button
                                                    className="w-14 h-14 rounded-2xl shadow-lg shadow-primary/20 active:scale-90 transition-all p-0 group-hover:bg-primary group-hover:text-primary-foreground"
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
                                                    <ShoppingCart className="w-7 h-7" />
                                                </Button>
                                            )
                                        ) : (
                                            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground opacity-50">
                                                <XCircle className="w-7 h-7" />
                                            </div>
                                        )}
                                    </div>
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
                <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[env(safe-area-inset-bottom,16px)] bg-background/80 backdrop-blur-2xl border-t border-border/40 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button 
                                variant="outline" 
                                className="h-16 px-6 rounded-2xl border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all flex items-center gap-3 relative" 
                                onClick={() => setShowCart(!showCart)}
                            >
                                <div className="relative">
                                    <ShoppingCart className="w-6 h-6 text-primary" />
                                    <Badge className="absolute -top-3 -right-3 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground font-black text-xs border-2 border-background">
                                        {cartItems.length}
                                    </Badge>
                                </div>
                                <span className="font-bold text-base hidden sm:block">Lihat Daftar</span>
                            </Button>
                            
                            {showCart && (
                                <div className="flex gap-2 overflow-x-auto max-w-[40vw] sm:max-w-[50vw] p-1 scrollbar-hide animate-in slide-in-from-left-4 duration-300">
                                    {cartItems.map((item) => (
                                        <Badge key={item.id} variant="secondary" className="h-12 shrink-0 gap-3 px-4 rounded-xl bg-muted/60 border border-border/20 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                            <span className="max-w-[100px] truncate font-semibold text-xs">{item.name}</span>
                                            <button 
                                                onClick={() => removeItem(item.id)}
                                                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-destructive/10 hover:text-destructive active:scale-75 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button 
                            className="h-16 px-8 rounded-2xl text-lg font-black shadow-lg shadow-primary/25 active:scale-[0.98] transition-all flex items-center gap-3" 
                            onClick={() => router.push('/borrower/checkout')}
                        >
                            PROSES PINJAM
                            <ArrowRight className="w-6 h-6 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
