export interface Profile {
    id: string
    name: string
    email: string | null
    role: 'admin' | 'borrower'
    description: string | null
    department: string | null
    card_barcode: string | null
    pin: string | null
    is_approved: boolean
    photo: string | null
    created_at: string
    updated_at: string
}

export interface Category {
    id: number
    name: string
    description: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    item_count?: number
}

export interface Item {
    id: number
    category_id: number
    name: string
    code: string
    barcode: string
    description: string | null
    status: 'available' | 'borrowed' | 'maintenance' | 'lost'
    image: string | null
    location: string | null
    condition: string
    is_active: boolean
    created_at: string
    updated_at: string
    category?: Category
}

export interface Loan {
    id: number
    user_id: string
    loan_code: string
    status: 'pending' | 'approved' | 'borrowed' | 'partial_return' | 'returned' | 'overdue' | 'cancelled'
    borrowed_at: string | null
    due_date: string | null
    returned_at: string | null
    approved_by: string | null
    returned_to: string | null
    notes: string | null
    return_notes: string | null
    created_at: string
    updated_at: string
    user?: Profile
    approver?: Profile
    returner?: Profile
    loan_items?: LoanItem[]
}

export interface LoanItem {
    id: number
    loan_id: number
    item_id: number
    returned_at: string | null
    condition_before: 'good' | 'fair' | 'poor'
    condition_after: 'good' | 'fair' | 'poor' | 'damaged' | 'lost' | null
    condition_note: string | null
    created_at: string
    updated_at: string
    item?: Item
}

export interface AuditLog {
    id: number
    user_id: string | null
    action: string
    model_type: string | null
    model_id: number | null
    old_values: Record<string, unknown> | null
    new_values: Record<string, unknown> | null
    ip_address: string | null
    user_agent: string | null
    description: string | null
    created_at: string
    user?: Profile
}

export interface CartItem {
    id: number
    name: string
    code: string
    barcode: string
    category_name: string
    image: string | null
}
