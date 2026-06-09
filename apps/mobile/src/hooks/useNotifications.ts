import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { notificationsApi } from '../services/api'

// Cómo se muestran las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function useNotifications(isLoggedIn: boolean) {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null)
  const responseListener     = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    if (!isLoggedIn) return

    // Pedir permiso y registrar token
    registerForPushNotificationsAsync()

    // Listener: notificación recibida mientras la app está abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificación recibida:', notification)
    })

    // Listener: usuario tocó la notificación → navegar a la pantalla correcta
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string>
      if (data?.type === 'new_match') {
        router.push('/(tabs)/matches')
      } else if (data?.type === 'new_message' && data?.matchId) {
        // Para navegar al chat necesitamos datos del match — ir a matches por ahora
        router.push('/(tabs)/matches')
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [isLoggedIn])
}

async function registerForPushNotificationsAsync() {
  // Las notificaciones push solo funcionan en dispositivo físico
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A855F7',
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Push notifications permission denied')
    return
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'alas-app', // Expo project slug — se puede dejar fijo
    })
    const token = tokenData.data
    console.log('Push token:', token)
    await notificationsApi.registerToken(token)
  } catch (err) {
    console.log('Error registrando push token:', err)
  }
}
