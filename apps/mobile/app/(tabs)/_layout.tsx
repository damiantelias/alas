import { Tabs } from 'expo-router'
import { colors } from '../../src/utils/theme'
import { Text, View } from 'react-native'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      tabBarActiveTintColor: colors.purple,
      tabBarInactiveTintColor: colors.muted,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Descubrir', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔍</Text> }} />
      <Tabs.Screen name="matches" options={{ title: 'Matches', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✨</Text> }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidad', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏠</Text> }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifs', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔔</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text> }} />
    </Tabs>
  )
}