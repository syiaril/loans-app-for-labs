import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { guestName, guestDescription, guestDepartment } = body

        if (!guestName) {
            return NextResponse.json({ error: 'Nama harus diisi' }, { status: 400 })
        }

        // Initialize Supabase admin client to bypass RLS and Auth rate limits
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        const tempEmail = `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}@lab.internal`
        const tempPassword = 'password123'

        // Create user via admin API to bypass rate limits
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: tempEmail,
            password: tempPassword,
            email_confirm: true,
        })

        if (authError || !authData.user) {
            console.error('Guest auth error:', authError)
            return NextResponse.json({ error: authError?.message || 'Gagal membuat akun' }, { status: 500 })
        }

        // Create profile
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
            id: authData.user.id,
            name: guestName,
            email: tempEmail,
            role: 'borrower',
            description: guestDescription || null,
            department: guestDepartment || null,
            is_approved: false,
        })

        if (profileError) {
            console.error('Guest profile error:', profileError)
            return NextResponse.json({ error: 'Gagal membuat profil tamu' }, { status: 500 })
        }

        // Log audit
        await supabaseAdmin.from('audit_logs').insert({
            user_id: authData.user.id,
            action: 'create',
            model_type: 'profile',
            description: `Registrasi tamu: ${guestName}`,
        })

        // Return the email and password so the client can automatically log in if needed
        return NextResponse.json({ 
            success: true, 
             email: tempEmail,
             password: tempPassword
        })

    } catch (error) {
        console.error('API Error:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
