import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <DashboardClient userId={user!.id} />
}
