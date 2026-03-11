import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const {
            name, email, password, role, description,
            department, card_barcode, pin, is_approved
        } = body

        // Verifikasi sesi pemanggil menggunakan SSR Supabase Auth
        const cookieStore = await cookies()
        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll() { }
                }
            }
        )
        const { data: { user } } = await supabaseAuth.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Gunakan SERVICE_ROLE_KEY untuk bypass RLS 
        // sehingga admin bisa membuat user tanpa merusak sesinya sendiri
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Verifikasi bahwa user yang memanggil ini adalah Admin
        const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (callerProfile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Hanya admin yang dapat membuat pengguna' }, { status: 403 })
        }

        // 1. Buat User Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Otomatis terkonfirmasi
        })

        if (authError || !authData.user) {
            return NextResponse.json({ error: authError?.message || 'Gagal membuat akun' }, { status: 400 })
        }

        // 2. Buat profil publik di tabel profiles
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
            id: authData.user.id,
            name,
            email,
            role,
            description: description || null,
            department: department || null,
            card_barcode: card_barcode || null,
            pin: pin || null,
            is_approved,
        })

        if (profileError) {
            // Jika profil gagal dibuat, hapus auth user tadi biar tidak nyangkut (Orphan)
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            return NextResponse.json({ error: profileError.message }, { status: 400 })
        }

        // 3. Catat di Audit Log
        await supabaseAdmin.from('audit_logs').insert({
            user_id: user.id,
            action: 'create',
            model_type: 'profile',
            description: `Membuat pengguna baru: ${name}`,
        })

        return NextResponse.json({ success: true, data: authData.user })

    } catch (error: unknown) {
        let msg = 'Internal Server Error'
        if (error instanceof Error) msg = error.message
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
