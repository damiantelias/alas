import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { colors } from '../src/utils/theme'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index"          options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding"     options={{ animation: 'fade' }} />
        <Stack.Screen name="login"          options={{ animation: 'fade' }} />
        <Stack.Screen name="register"       options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reset-password"  options={{ presentation: 'modal' }} />
        <Stack.Screen name="(tabs)"         options={{ animation: 'none' }} />
        <Stack.Screen name="chat"           options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="edit-profile"   options={{ presentation: 'modal' }} />
        <Stack.Screen name="upgrade"        options={{ presentation: 'modal' }} />
        <Stack.Screen name="verification"   options={{ presentation: 'modal' }} />
        <Stack.Screen name="likes-received" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </GestureHandlerRootView>
  )
}
