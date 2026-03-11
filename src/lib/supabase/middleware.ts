import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Get user profile for role checking
    let profile = null
    if (user) {
        const { data } = await supabase
            .from('profiles')
            .select('role, is_approved')
            .eq('id', user.id)
            .single()
        profile = data
    }

    const pathname = request.nextUrl.pathname

    // Public routes - accessible without login
    if (pathname === '/' || pathname.startsWith('/api/scan') || pathname.startsWith('/api/quick-return') || pathname.startsWith('/api/reports/') || pathname.startsWith('/api/auth/barcode')) {
        return supabaseResponse
    }

    // Auth routes - redirect to dashboard if already logged in
    if (pathname === '/login' || pathname === '/pending-approval') {
        if (user && profile) {
            if (!profile.is_approved) {
                if (pathname !== '/pending-approval') {
                    const url = request.nextUrl.clone()
                    url.pathname = '/pending-approval'
                    return NextResponse.redirect(url)
                }
                return supabaseResponse
            }
            const url = request.nextUrl.clone()
            url.pathname = profile.role === 'admin' ? '/admin/dashboard' : '/borrower/dashboard'
            return NextResponse.redirect(url)
        }
        return supabaseResponse
    }

    // Protected routes - redirect to login if not authenticated
    if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Check if user is approved
    if (profile && !profile.is_approved) {
        const url = request.nextUrl.clone()
        url.pathname = '/pending-approval'
        return NextResponse.redirect(url)
    }

    // Role-based routing
    if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/borrower/dashboard'
        return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/borrower') && profile?.role === 'admin') {
        // Admin can still access borrower routes (optional, or redirect)
        return supabaseResponse
    }

    return supabaseResponse
}
