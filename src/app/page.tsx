'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BarcodeScanner from '@/components/scanner/barcode-scanner'
import { useCart } from '@/hooks/use-cart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ITEM_STATUS_LABELS, ITEM_STATUS_COLORS } from '@/lib/utils'
import {
  FlaskConical, ShoppingCart, Trash2, LogIn, Search, X,
  Package, ArrowRight, Undo2, Loader2, KeyRound, Sun, Moon
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { Item } from '@/lib/types/database'
import { CardSkeleton } from '@/components/skeletons'

interface ScanResult {
  item: Item & { category?: { name: string } }
  borrower?: {
    loan_code: string
    borrowed_at: string
    due_date: string
    user: { name: string; department: string }
  }
}

export default function PublicScanPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { items: cartItems, addItem, removeItem, isInCart, clearCart } = useCart()
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Item[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [returning, setReturning] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [returnPin, setReturnPin] = useState('')
  const [returnBarcode, setReturnBarcode] = useState('')
  const [returnBorrowerName, setReturnBorrowerName] = useState('')

  async function handleScan(barcode: string) {
    setLoading(true)
    setScanResult(null)
    try {
      const res = await fetch(`/api/scan?barcode=${encodeURIComponent(barcode)}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Barang tidak ditemukan')
        return
      }
      setScanResult(data)
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/scan?query=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data.items) {
        setSearchResults(data.items)
      }
    } catch {
      toast.error('Gagal mencari')
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleQuickReturn(barcode: string, pin?: string) {
    setReturning(true)
    try {
      const res = await fetch('/api/quick-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, pin }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setScanResult(null)
        setShowPinDialog(false)
        setReturnPin('')
        setReturnBarcode('')
        setReturnBorrowerName('')
      } else if (data.requires_pin) {
        // Show PIN dialog
        setReturnBarcode(barcode)
        setReturnPin('') // Ensure PIN is empty when dialog opens
        if (data.borrower_name) setReturnBorrowerName(data.borrower_name)
        setShowPinDialog(true)
        if (pin) {
          toast.error(data.error)
        }
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Gagal mengembalikan barang')
    } finally {
      setReturning(false)
    }
  }

  function handlePinSubmit() {
    if (!returnPin.trim()) {
      toast.error('Masukkan PIN terlebih dahulu')
      return
    }
    handleQuickReturn(returnBarcode, returnPin)
  }

  function handleAddToCart(item: Item & { category?: { name: string } }) {
    addItem({
      id: item.id,
      name: item.name,
      code: item.code,
      barcode: item.barcode,
      category_name: item.category?.name || '',
      image: item.image,
    })
    toast.success(`${item.name} ditambahkan ke keranjang`)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[100px] animate-pulse duration-[10s]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-violet-500/10 dark:bg-violet-500/5 rounded-full blur-[100px] animate-pulse duration-[8s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 dark:bg-primary/5 rounded-full blur-[120px]" />
      </div>

      {/* Floating Theme Toggle */}
      <div className="fixed top-4 right-4 z-[100]">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-12 h-12 bg-background/50 backdrop-blur-md border-border/40 shadow-sm hover:scale-110 active:scale-95 transition-all"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className={`grid grid-cols-1 ${cartItems.length > 0 ? 'lg:grid-cols-12' : 'max-w-2xl mx-auto'} gap-8 items-start transition-all duration-500`}>
          {/* Left Column: Scanner & Search */}
          <div className={`${cartItems.length > 0 ? 'lg:col-span-7 xl:col-span-8' : ''} space-y-6`}>
            {/* Header */}
            <div className={`flex items-center gap-4 mb-8 ${cartItems.length === 0 ? 'justify-center flex-col text-center' : ''}`}>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden bg-white border border-primary/20 shadow-lg shrink-0">
                <img src="https://skensa-rpl.com/images/logo_rpl.png" alt="Logo Pojok Lab" className="w-full h-full object-contain p-1.5" />
              </div>
              <div className={cartItems.length === 0 ? 'text-center' : 'text-left'}>
                <h1 className={`${cartItems.length === 0 ? 'text-4xl' : 'text-3xl'} font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent`}>
                  Pojok Lab
                </h1>
                <p className="text-muted-foreground text-sm font-medium">
                  Sistem Peminjaman Barang Lab Komputer RPL
                </p>
              </div>
            </div>

            {/* Scanner */}
            <Card className="backdrop-blur-2xl bg-card/70 border-border/40 shadow-xl overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Package className="w-5 h-5 text-primary" />
                  Scan Barang
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BarcodeScanner
                  onScan={(barcode) => {
                    handleScan(barcode)
                  }}
                  placeholder="Scan barcode barang..."
                />
              </CardContent>
            </Card>

            {/* Loading */}
            {loading && (
              <Card className="backdrop-blur-2xl bg-card/70 border-border/40 shadow-xl overflow-hidden mt-4">
                <CardSkeleton lines={3} />
              </Card>
            )}

            {/* Scan Result */}
            {scanResult && (
              <Card className="backdrop-blur-2xl bg-card/70 border-border/40 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex flex-1 items-center gap-4">
                      <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center shrink-0 overflow-hidden shadow-md border border-border/50">
                        {scanResult.item.image ? (
                          <img 
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/items/${scanResult.item.image}`} 
                            alt={scanResult.item.name}
                            className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" 
                          />
                        ) : (
                          <Package className="w-12 h-12 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg">{scanResult.item.name}</h3>
                        <p className="text-sm text-muted-foreground">{scanResult.item.code} • {scanResult.item.category?.name}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`text-[10px] ${ITEM_STATUS_COLORS[scanResult.item.status]}`}>
                            {ITEM_STATUS_LABELS[scanResult.item.status]}
                          </Badge>
                          {scanResult.item.location && (
                            <span className="text-[10px] text-muted-foreground">📍 {scanResult.item.location}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 w-full sm:w-auto flex items-center justify-center sm:border-l border-border/40 sm:pl-6">
                      {scanResult.item.status === 'available' && (
                        <div className="w-20 h-20">
                          {isInCart(scanResult.item.id) ? (
                            <div className="flex flex-col items-center justify-center w-full h-full text-emerald-500 border-2 border-emerald-500/20 rounded-2xl bg-emerald-500/5 shadow-inner">
                              <Package className="w-8 h-8" />
                            </div>
                          ) : (
                            <Button 
                              className="w-full h-full rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 px-0" 
                              onClick={() => handleAddToCart(scanResult.item)}
                            >
                              <ShoppingCart className="w-8 h-8" />
                            </Button>
                          )}
                        </div>
                      )}

                      {scanResult.item.status === 'borrowed' && scanResult.borrower && (
                        <div className="w-20 h-20">
                           <Button
                            className="w-full h-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 px-0"
                            onClick={() => handleQuickReturn(scanResult.item.barcode)}
                            disabled={returning}
                          >
                            <Undo2 className="w-8 h-8" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manual Search */}
            <div className="space-y-3">
              <Button
                variant="ghost"
                onClick={() => setShowSearch(!showSearch)}
                className="w-full h-12 rounded-xl bg-muted/30 hover:bg-muted/50 border border-dashed border-border/60"
              >
                <Search className="w-4 h-4 mr-2" />
                {showSearch ? 'Tutup Pencarian Manual' : 'Cari Manual (jika barcode rusak)'}
              </Button>

              {showSearch && (
                <Card className="backdrop-blur-xl bg-card/80 border-border/50 overflow-hidden">
                  <CardContent className="pt-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Cari nama atau kode barang..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="h-11 shadow-sm"
                      />
                      <Button onClick={handleSearch} disabled={searchLoading} className="h-11 px-6">
                        CARI
                      </Button>
                    </div>
                    {searchLoading ? (
                      <div className="mt-4"><CardSkeleton lines={2} /></div>
                    ) : searchResults.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {searchResults.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/30 hover:bg-muted transition-colors"
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="font-semibold text-sm truncate">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.code}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.status === 'available' && !isInCart(item.id) && (
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="h-9 w-9 rounded-lg shadow-sm"
                                  onClick={() => handleAddToCart(item as Item & { category?: { name: string } })}
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right Column: Cart (Sidebar style) */}
          {cartItems.length > 0 && (
            <div className="lg:col-span-5 xl:col-span-4 sticky top-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <Card className="backdrop-blur-2xl bg-card/70 border-border/40 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-4rem)]">
                <CardHeader className="border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 rounded-xl">
                        <ShoppingCart className="w-6 h-6 text-primary" />
                      </div>
                      Daftar Pinjam
                    </CardTitle>
                    <Badge variant="secondary" className="px-3 py-1 text-base font-black rounded-lg">
                      {cartItems.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 flex flex-col">
                  <div className="space-y-3 mb-6">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/60 border border-border/20 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground tracking-wider">{item.code}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-full shrink-0"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-auto space-y-3 pt-4 border-t border-border/40">
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-14 rounded-2xl font-medium" onClick={clearCart}>
                        Hapus Semua
                      </Button>
                      <Button 
                        className="flex-[2] h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/25 active:scale-[0.98]" 
                        onClick={() => router.push('/login')}
                      >
                        <LogIn className="w-5 h-5 mr-2" />
                        PINJAM
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* PIN Verification Dialog - Remains Global/Overlay */}
        {showPinDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-sm bg-card border-border/50 animate-in zoom-in-95 duration-200 shadow-2xl">
              <CardHeader className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-7 h-7 text-emerald-400" />
                </div>
                <CardTitle className="text-lg">Verifikasi PIN</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {returnBorrowerName
                    ? `Masukkan PIN milik ${returnBorrowerName} untuk mengembalikan barang`
                    : 'Masukkan PIN peminjam untuk verifikasi'
                  }
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="password"
                  maxLength={6}
                  placeholder="Masukkan PIN (6 digit)"
                  value={returnPin}
                  onChange={(e) => setReturnPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                  autoFocus
                  autoComplete="new-password"
                  className="text-center text-lg tracking-widest"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                    onClick={() => {
                      setShowPinDialog(false)
                      setReturnPin('')
                      setReturnBarcode('')
                      setReturnBorrowerName('')
                    }}
                  >
                    Batal
                  </Button>
                  <Button
                    className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] shadow-lg shadow-emerald-600/20"
                    onClick={handlePinSubmit}
                    disabled={returning || !returnPin.trim()}
                  >
                    {returning ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Memproses...</>
                    ) : (
                      'Kembalikan'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
