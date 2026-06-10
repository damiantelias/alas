import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { colors, spacing, radius } from '../utils/theme'
import { authApi } from '../services/api'

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [showPass,  setShowPass]  = useState(false)

  async function handleSubmit() {
    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token as string, password)
      setDone(true)
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Link inválido o expirado')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <View style={styles.container}>
      <View style={styles.doneBox}>
        <Text style={styles.doneEmoji}>✅</Text>
        <Text style={styles.doneTitle}>¡Contraseña actualizada!</Text>
        <Text style={styles.doneSub}>Ya podés iniciar sesión con tu nueva contraseña.</Text>
      </View>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/login')}>
        <Text style={styles.btnText}>Iniciar sesión</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🔑</Text>
      <Text style={styles.title}>Nueva contraseña</Text>
      <Text style={styles.subtitle}>Elegí una contraseña segura de al menos 8 caracteres.</Text>

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Nueva contraseña"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPass}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
          <Text style={styles.eyeText}>{showPass ? '🙈' : '👁'}</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Repetir contraseña"
        placeholderTextColor={colors.muted}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry={!showPass}
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.btn, (password.length < 8 || loading) && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={password.length < 8 || loading}
      >
        {loading
          ? <ActivityIndicator size="small" color={colors.white} />
          : <Text style={styles.btnText}>Guardar contraseña</Text>
        }
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    padding: spacing.lg, paddingTop: 80, justifyContent: 'center',
  },
  logo:     { fontSize: 48, textAlign: 'center', marginBottom: spacing.md },
  title:    { fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  inputWrapper: { position: 'relative', marginBottom: spacing.md },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14,
    color: colors.text, fontSize: 15, marginBottom: spacing.md,
  },
  eyeBtn:  { position: 'absolute', right: 14, top: 14 },
  eyeText: { fontSize: 18 },
  btn: {
    backgroundColor: colors.purple, borderRadius: radius.full,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: colors.white, fontWeight: '800', fontSize: 15 },
  doneBox: {
    alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, marginBottom: spacing.xl,
  },
  doneEmoji: { fontSize: 48, marginBottom: spacing.md },
  doneTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  doneSub:   { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
})
