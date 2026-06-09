import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/auth.store'

export default function Index() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  
  if (!isLoggedIn) return <Redirect href="/login" />
  return <Redirect href="/tabs" />
}