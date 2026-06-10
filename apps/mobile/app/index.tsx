import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../src/store/auth.store'

export default function Index() {
  const { isLoggedIn, isLoading } = useAuthStore()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync('onboarding_done').then(val => {
      setOnboardingDone(val === '1')
    })
  }, [])

  // Esperar a que se resuelvan ambos checks
  if (isLoading || onboardingDone === null) return null

  if (!onboardingDone) return <Redirect href="/onboarding" />
  if (!isLoggedIn)     return <Redirect href="/login" />
  return <Redirect href="/(tabs)" />
}
