import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, radius } from '../utils/theme'
import { authApi } from '../services/api'

export default function ForgotPasswordScreen() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)

  async function handleSubmit() {
    if (!email.trim()) return
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim().toLowerCase())
      setSent(true)
    } catch {
      Alert.alert('Error', 'No se pudo enviar el email. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <Text style={styles.logo}>🪶</Text>
      <Text style={styles.title}>Recuperar contraseña</Text>

      {sent ? (
        <>
          <View style={styles.sentBox}>
            <Text style={styles.sentEmoji}>📬</Text>
            <Text style={styles.sentTitle}>¡Revisá tu email!</Text>
            <Text style={styles.sentSub}>
              Si {email} tiene una cuenta en Alas, te enviamos un link para restablecer tu contraseña.
            </Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/login')}>
            <Text style={styles.btnText}>Volver al inicio</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Ingresá tu email y te mandamos un link para crear una nueva contraseña.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.btn, (!email.trim() || loading) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!email.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.btnText}>Enviar link</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    padding: spacing.lg, paddingTop: 60,
  },
  backBtn:  { marginBottom: spacing.xl },
  backText: { fontSize: 22, color: colors.muted },
  logo:     { fontSize: 48, textAlign: 'center', marginBottom: spacing.md },
  title:    { fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14,
    color: colors.text, fontSize: 15, marginBottom: spacing.md,
  },
  btn: {
    backgroundColor: colors.purple, borderRadius: radius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: colors.white, fontWeight: '800', fontSize: 15 },
  sentBox: {
    alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, marginBottom: spacing.xl,
  },
  sentEmoji: { fontSize: 48, marginBottom: spacing.md },
  sentTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  sentSub:   { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
})
