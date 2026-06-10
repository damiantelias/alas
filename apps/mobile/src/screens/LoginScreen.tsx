import { router } from 'expo-router'
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { useAuthStore } from '../store/auth.store'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const login = useAuthStore(s => s.login)

  async function handleLogin() {
    if (!email || !password) {
      return Alert.alert('Completá todos los campos')
    }
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      router.replace('/(tabs)')
      // La navegación la maneja el root layout según isLoggedIn
    } catch (err: any) {
      const msg = err.response?.data?.error ?? 'Error al iniciar sesión'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Logo */}
      <View style={styles.header}>
        <Text style={styles.logo}>Alas</Text>
        <Text style={styles.tagline}>vuela libre 🏳️‍🌈</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="tu@email.com"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnText}>Iniciar sesión</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/forgot-password')}>
          <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnGhost}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.btnGhostText}>
            ¿No tenés cuenta? <Text style={{ color: colors.purple }}>Registrate</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 52,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  form: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  btnGhost: {
    alignItems: 'center',
    padding: spacing.md,
  },
  btnGhostText: {
    color: colors.muted,
    fontSize: 14,
  },
  forgotLink: { alignItems: 'center', paddingVertical: 10, marginBottom: 4 },
  forgotText: { color: colors.muted, fontSize: 13 },
})
