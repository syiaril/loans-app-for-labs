import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
    try {
        const { barcode } = await request.json()

        if (!barcode) {
            return NextResponse.json({ error: 'Barcode is required' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase environment variables')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Use service role key to bypass RLS since unauthenticated users can't read profiles
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const cleanBarcode = barcode.replace(/"/g, '').trim()
        
        // 1. Try exact match on card_barcode
        let { data: profile, error } = await supabase
            .from('profiles')
            .select('id, email, name, pin')
            .eq('card_barcode', cleanBarcode)
            .single()

        // 2. Fallback: match UUID prefix if not found
        if (error || !profile) {
            if (cleanBarcode.length >= 8) {
                const { data: fallbackProfiles } = await supabase
                    .from('profiles')
                    .select('id, email, name, pin')
                    .or('card_barcode.is.null,card_barcode.eq.')
                
                const cleanBarcodeNoHyphens = cleanBarcode.replace(/-/g, '')
                const matchedProfile = fallbackProfiles?.find(p => p.id.replace(/-/g, '').startsWith(cleanBarcodeNoHyphens))
                
                if (matchedProfile) {
                    profile = matchedProfile
                    error = null
                }
            }
        }

        if (error || !profile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json(profile)

    } catch (error: any) {
        console.error('Barcode lookup error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
