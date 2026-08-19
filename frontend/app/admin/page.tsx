'use client'

import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { AccessKeyGate } from '@/components/auth/AccessKeyGate'

export default function AdminPage() {
  return (
    <AccessKeyGate>
      <AdminDashboard />
    </AccessKeyGate>
  )
}
