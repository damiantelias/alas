import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { colors, spacing, radius } from '../utils/theme'
import { verifyApi } from '../services/api'

type Status = 'none' | 'pending' | 'approved' | 'rejected'

export default function VerificationScreen() {
  const [status,    setStatus]    = useState<Status>('none')
  const [loading,   setLoading]   = useState(true)
  const [selfieUri, setSelfieUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadStatus() }, [])

  async function loadStatus() {
    try {
      const { data } = await verifyApi.getStatus()
      const d = data.data
      if (d.isVerified)                    setStatus('approved')
      else if (d.requestStatus === 'pending')  setStatus('pending')
      else if (d.requestStatus === 'rejected') setStatus('rejected')
      else                                     setStatus('none')
    } catch {
      setStatus('none')
    } finally {
      setLoading(false)
    }
  }

  async function handlePickSelfie() {
    const { status: perm } = await ImagePicker.requestCameraPermissionsAsync()
    if (perm !== 'granted') {
      // Intentar con galería como fallback
      const galleryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (galleryPerm.status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara o galería para la selfie.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      })
      if (!result.canceled) setSelfieUri(result.assets[0].uri)
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8, cameraType: ImagePicker.CameraType.front,
    })
    if (!result.canceled) setSelfieUri(result.assets[0].uri)
  }

  async function handleSubmit() {
    if (!selfieUri) return
    setUploading(true)
    try {
      await verifyApi.request(selfieUri)
      setStatus('pending')
      setSelfieUri(null)
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'No se pudo enviar la solicitud')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.purple} />
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Verificar perfil</Text>
      </View>

      {/* Aprobado */}
      {status === 'approved' && (
        <View style={styles.statusBox}>
          <Text style={styles.statusEmoji}>✅</Text>
          <Text style={[styles.statusTitle, { color: colors.teal }]}>¡Tu perfil está verificado!</Text>
          <Text style={styles.statusSub}>Aparece el badge ✓ en tu perfil. La comunidad puede confiar en que sos real.</Text>
        </View>
      )}

      {/* Pendiente */}
      {status === 'pending' && (
        <View style={styles.statusBox}>
          <Text style={styles.statusEmoji}>⏳</Text>
          <Text style={[styles.statusTitle, { color: colors.amber }]}>En revisión</Text>
          <Text style={styles.statusSub}>Tu solicitud está siendo revisada. Te notificaremos en menos de 24 horas.</Text>
        </View>
      )}

      {/* Rechazado o sin solicitud */}
      {(status === 'none' || status === 'rejected') && (
        <>
          {status === 'rejected' && (
            <View style={[styles.statusBox, styles.rejectedBox]}>
              <Text style={styles.statusEmoji}>❌</Text>
              <Text style={[styles.statusTitle, { color: '#ef4444' }]}>Solicitud rechazada</Text>
              <Text style={styles.statusSub}>La selfie no cumplió los requisitos. Podés intentarlo de nuevo.</Text>
            </View>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>¿Qué es la verificación?</Text>
            <Text style={styles.infoText}>
              Un badge ✓ azul en tu perfil que demuestra que sos una persona real. Genera más confianza y aumenta tus matches.
            </Text>
          </View>

          <View style={styles.stepsBox}>
            {[
              { n: '1', text: 'Sacate una selfie sosteniendo un papel con "Alas" escrito' },
              { n: '2', text: 'La foto debe mostrar tu cara claramente' },
              { n: '3', text: 'Nuestro equipo la revisa en menos de 24hs' },
            ].map(s => (
              <View key={s.n} style={styles.step}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{s.n}</Text>
                </View>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}
          </View>

          {/* Preview de selfie */}
          {selfieUri ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: selfieUri }} style={styles.previewImg} />
              <TouchableOpacity style={styles.changeSelfieBtn} onPress={handlePickSelfie}>
                <Text style={styles.changeSelfieText}>Cambiar selfie</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickBtn} onPress={handlePickSelfie}>
              <Text style={styles.pickIcon}>📸</Text>
              <Text style={styles.pickText}>Sacar selfie de verificación</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (!selfieUri || uploading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!selfieUri || uploading}
          >
            {uploading
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.submitText}>Enviar para revisión</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: spacing.lg, paddingBottom: 60 },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingTop: 16, marginBottom: spacing.xl,
  },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: colors.text },
  title:    { fontSize: 20, fontWeight: '900', color: colors.text },

  statusBox: {
    alignItems: 'center', padding: spacing.xl,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl,
  },
  rejectedBox:  { borderColor: '#ef444440' },
  statusEmoji:  { fontSize: 48, marginBottom: spacing.md },
  statusTitle:  { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  statusSub:    { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },

  infoBox: {
    backgroundColor: 'rgba(168,85,247,0.08)', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
    padding: spacing.md, marginBottom: spacing.lg,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: colors.purple, marginBottom: 6 },
  infoText:  { fontSize: 13, color: colors.muted, lineHeight: 20 },

  stepsBox: { gap: spacing.md, marginBottom: spacing.xl },
  step:     { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1, borderColor: colors.purple,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { fontSize: 13, fontWeight: '700', color: colors.purple },
  stepText:    { fontSize: 14, color: colors.muted, lineHeight: 20, flex: 1 },

  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.lg, paddingVertical: spacing.xl, marginBottom: spacing.lg,
  },
  pickIcon: { fontSize: 28 },
  pickText: { fontSize: 15, color: colors.muted, fontWeight: '600' },

  previewBox:      { alignItems: 'center', marginBottom: spacing.lg },
  previewImg:      { width: 160, height: 160, borderRadius: radius.full, marginBottom: spacing.md },
  changeSelfieBtn: { paddingVertical: 6 },
  changeSelfieText:{ color: colors.purple, fontSize: 13 },

  submitBtn: {
    backgroundColor: colors.purple, borderRadius: radius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText:        { color: colors.white, fontWeight: '800', fontSize: 15 },
})
