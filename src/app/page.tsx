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
  Package, ArrowRight, Undo2, Loader2, KeyRound
} from 'lucide-react'
import type { Item } from '@/lib/types/database'

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
  const [liveResults, setLiveResults] = useState<(Item & { category?: { name: string } })[]>([])
  const [liveSearchLoading, setLiveSearchLoading] = useState(false)

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
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 mb-4 backdrop-blur-sm">
            <FlaskConical className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            SiPinjam Lab
          </h1>
          <p className="text-muted-foreground mt-2">
            Sistem Peminjaman Barang Lab Komputer RPL
          </p>
        </div>

        {/* Scanner */}
        <Card className="backdrop-blur-xl bg-card/80 border-border/50 mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5" />
              Scan Barang
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarcodeScanner
              onScan={(barcode) => {
                setLiveResults([])
                handleScan(barcode)
              }}
              onSearchResults={(results) => setLiveResults(results as (Item & { category?: { name: string } })[])}
              onSearchLoading={setLiveSearchLoading}
              placeholder="Scan barcode atau ketik nama barang..."
            />
          </CardContent>
        </Card>

        {/* Realtime Search Results — rendered OUTSIDE the Card */}
        {(liveResults.length > 0 || liveSearchLoading) && (
          <Card className="backdrop-blur-xl bg-card/80 border-border/50 mb-6 animate-in fade-in duration-200">
            <CardContent className="pt-4 pb-2">
              {liveSearchLoading && liveResults.length === 0 && (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mencari...
                </div>
              )}
              <div className="divide-y divide-border/30">
                {liveResults.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors"
                    onClick={() => {
                      setLiveResults([])
                      handleScan(item.barcode)
                    }}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.status === 'borrowed'
                      ? 'bg-yellow-500/10'
                      : 'bg-emerald-500/10'
                      }`}>
                      <Package className={`w-4 h-4 ${item.status === 'borrowed' ? 'text-yellow-400' : 'text-emerald-400'
                        }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.code} • {item.category?.name || ''}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] ${ITEM_STATUS_COLORS[item.status] || ''}`}
                    >
                      {ITEM_STATUS_LABELS[item.status] || item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Scan Result */}
        {scanResult && (
          <Card className="backdrop-blur-xl bg-card/80 border-border/50 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{scanResult.item.name}</h3>
                  <p className="text-sm text-muted-foreground">{scanResult.item.code} • {scanResult.item.category?.name}</p>
                  {scanResult.item.description && (
                    <p className="text-sm text-muted-foreground mt-1">{scanResult.item.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={ITEM_STATUS_COLORS[scanResult.item.status]}>
                      {ITEM_STATUS_LABELS[scanResult.item.status]}
                    </Badge>
                    {scanResult.item.location && (
                      <span className="text-xs text-muted-foreground">📍 {scanResult.item.location}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Available: add to cart */}
              {scanResult.item.status === 'available' && (
                <div className="mt-4">
                  {isInCart(scanResult.item.id) ? (
                    <Button variant="outline" className="w-full" disabled>
                      ✓ Sudah di keranjang
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => handleAddToCart(scanResult.item)}>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Tambah ke Daftar Pinjam
                    </Button>
                  )}
                </div>
              )}

              {/* Borrowed: show borrower + quick return */}
              {scanResult.item.status === 'borrowed' && scanResult.borrower && (
                <div className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm font-medium text-yellow-400">Sedang dipinjam oleh:</p>
                    <p className="text-sm">{(scanResult.borrower as unknown as { user: { name: string } }).user?.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Kode: {scanResult.borrower.loan_code}
                    </p>
                    {scanResult.borrower.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Jatuh tempo: {new Date(scanResult.borrower.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleQuickReturn(scanResult.item.barcode)}
                    disabled={returning}
                  >
                    <Undo2 className="w-4 h-4 mr-2" />
                    {returning ? 'Memproses...' : 'Kembalikan Barang Sekarang'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Manual Search Toggle */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="w-full"
          >
            <Search className="w-4 h-4 mr-2" />
            {showSearch ? 'Tutup Pencarian Manual' : 'Cari Manual (jika barcode rusak)'}
          </Button>

          {showSearch && (
            <Card className="mt-3 backdrop-blur-xl bg-card/80 border-border/50">
              <CardContent className="pt-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Cari nama atau kode barang..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={searchLoading}>
                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={ITEM_STATUS_COLORS[item.status]}>
                            {ITEM_STATUS_LABELS[item.status]}
                          </Badge>
                          {item.status === 'available' && !isInCart(item.id) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAddToCart(item as Item & { category?: { name: string } })}
                            >
                              +
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

        {/* PIN Verification Dialog */}
        {showPinDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-sm bg-card border-border/50 animate-in zoom-in-95 duration-200">
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
                  className="text-center text-lg tracking-widest"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
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
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handlePinSubmit}
                    disabled={returning || !returnPin.trim()}
                  >
                    {returning ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</>
                    ) : (
                      'Kembalikan'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cart */}
        {cartItems.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50">
            <div className="max-w-2xl mx-auto">
              {showCart ? (
                <Card className="bg-card/90 border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Daftar Pinjam ({cartItems.length})</CardTitle>
                      <Button variant="ghost" size="icon" onClick={() => setShowCart(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                      {cartItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.code}</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={clearCart}>
                        Kosongkan
                      </Button>
                      <Button className="flex-1" onClick={() => router.push('/login')}>
                        <LogIn className="w-4 h-4 mr-2" />
                        Login & Pinjam
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button className="w-full" onClick={() => setShowCart(true)}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Keranjang ({cartItems.length} barang)
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Footer spacer */}
        <div className="pb-24" />
      </div>
    </div>
  )
}
