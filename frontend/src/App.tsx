import '@/i18n/config'
import { MainLayout } from '@/components/layout/MainLayout'
import { useSessionHydration } from '@/hooks/use-session-hydration'

export function App() {
  useSessionHydration()
  return <MainLayout />
}
