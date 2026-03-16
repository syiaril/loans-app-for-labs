'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function PendingUserApproveButton({ userId, onApprove }: { userId: string, onApprove?: () => void }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    
    async function handleApprove() {
        setLoading(true)
        const supabase = createClient()
        const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', userId)
        
        if (error) {
            toast.error('Gagal menyetujui pengguna')
        } else {
            const { data: { user } } = await supabase.auth.getUser()
            await supabase.from('audit_logs').insert({
                user_id: user?.id,
                action: 'approve',
                model_type: 'profile',
                description: `Menyetujui pengguna`,
            })
            toast.success('Pengguna berhasil disetujui')
            if (onApprove) {
                onApprove()
            } else {
                router.refresh()
            }
        }
        setLoading(false)
    }

    return (
        <Button 
            variant="outline" 
            size="sm" 
            onClick={handleApprove} 
            disabled={loading} 
            className="h-8 border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium transition-colors"
        >
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
            Setujui
        </Button>
    )
}
