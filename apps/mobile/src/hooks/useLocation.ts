import { useEffect } from 'react'
import * as Location from 'expo-location'
import { profileApi } from '../services/api'

export function useLocation(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return
    updateLocation()
  }, [isLoggedIn])
}

export async function updateLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })

    const { latitude, longitude } = loc.coords
    await profileApi.update({ latitude, longitude })
    return { latitude, longitude }
  } catch (err) {
    console.log('Location error:', err)
    return null
  }
}
