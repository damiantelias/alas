import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { colors, spacing } from '../utils/theme'

import LoginScreen         from '../screens/LoginScreen'
import RegisterScreen      from '../screens/RegisterScreen'
import DiscoverScreen      from '../screens/DiscoverScreen'
import MatchesScreen       from '../screens/MatchesScreen'
import ChatScreen          from '../screens/ChatScreen'
import ProfileScreen       from '../screens/ProfileScreen'
import CommunityScreen     from '../screens/CommunityScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import { useAuthStore }    from '../store/auth.store'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

function CustomTabBar({ state, navigation }: any) {
  const tabs = [
    { name: 'Discover',       emoji: '🔍', label: 'Descubrir'   },
    { name: 'Matches',        emoji: '✨', label: 'Matches'     },
    { name: 'Community',      emoji: '🏠', label: 'Comunidad'   },
    { name: 'Notifications',  emoji: '🔔', label: 'Notifs'      },
    { name: 'Profile',        emoji: '👤', label: 'Perfil'      },
  ]
  return (
    <View style={tabStyles.bar}>
      {tabs.map((tab, i) => {
        const active = state.index === i
        return (
          <TouchableOpacity key={tab.name} style={tabStyles.tab}
            onPress={() => navigation.navigate(tab.name)} activeOpacity={0.7}>
            <Text style={tabStyles.emoji}>{tab.emoji}</Text>
            <Text style={[tabStyles.label, active && tabStyles.labelActive]}>{tab.label}</Text>
            {active && <View style={tabStyles.dot} />}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: 'rgba(16,16,26,0.97)',
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingBottom: 24, paddingTop: 10,
  },
  tab:         { flex: 1, alignItems: 'center', gap: 2 },
  emoji:       { fontSize: 18 },
  label:       { fontSize: 9, color: colors.muted, letterSpacing: 0.3 },
  labelActive: { color: colors.purple },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.purple, marginTop: 1 },
})

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Discover"      component={DiscoverScreen} />
      <Tab.Screen name="Matches"       component={MatchesScreen} />
      <Tab.Screen name="Community"     component={CommunityScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile"       component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const { isLoggedIn, isLoading, loadSession } = useAuthStore()
  useEffect(() => { loadSession() }, [])
  if (isLoading) return null

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Chat" component={ChatScreen}
              options={{ presentation: 'card', gestureEnabled: true }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
