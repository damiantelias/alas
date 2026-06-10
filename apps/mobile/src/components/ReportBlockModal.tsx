import React, { useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { reportsApi, blocksApi } from '../services/api'

interface Props {
  visible: boolean
  onClose: () => void
  targetUserId: string
  targetName: string
  onBlocked?: () => void
}

const REPORT_REASONS = [
  { key: 'fake_profile',    label: 'Perfil falso o spam' },
  { key: 'inappropriate',   label: 'Contenido inapropiado' },
  { key: 'harassment',      label: 'Acoso o amenazas' },
  { key: 'underage',        label: 'Posible menor de edad' },
  { key: 'hate_speech',     label: 'Discurso de odio' },
  { key: 'other',           label: 'Otro motivo' },
]

type Step = 'menu' | 'report_reason' | 'report_details' | 'done'

export default function ReportBlockModal({ visible, onClose, targetUserId, targetName, onBlocked }: Props) {
  const [step,     setStep]     = useState<Step>('menu')
  const [reason,   setReason]   = useState('')
  const [details,  setDetails]  = useState('')
  const [loading,  setLoading]  = useState(false)

  function reset() {
    setStep('menu')
    setReason('')
    setDetails('')
    setLoading(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleBlock() {
    Alert.alert(
      `Bloquear a ${targetName}`,
      'No se podrán ver mutuamente y se eliminará el match si lo había. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            try {
              await blocksApi.block(targetUserId)
              handleClose()
              onBlocked?.()
            } catch {
              Alert.alert('Error', 'No se pudo bloquear al usuario')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  async function handleSubmitReport() {
    if (!reason) return
    setLoading(true)
    try {
      await reportsApi.create(targetUserId, reason, details.trim() || undefined)
      setStep('done')
    } catch {
      Alert.alert('Error', 'No se pudo enviar el reporte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          <View style={styles.handle} />

          {/* Menú principal */}
          {step === 'menu' && (
            <>
              <Text style={styles.title}>{targetName}</Text>
              <TouchableOpacity style={styles.menuItem} onPress={() => setStep('report_reason')}>
                <Text style={styles.menuIcon}>🚩</Text>
                <Text style={styles.menuText}>Reportar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={handleBlock} disabled={loading}>
                <Text style={styles.menuIcon}>🚫</Text>
                <Text style={[styles.menuText, styles.menuTextDanger]}>Bloquear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Elegir motivo */}
          {step === 'report_reason' && (
            <>
              <Text style={styles.title}>¿Por qué reportás?</Text>
              <Text style={styles.subtitle}>Tu reporte es anónimo</Text>
              {REPORT_REASONS.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.reasonItem, reason === r.key && styles.reasonItemActive]}
                  onPress={() => setReason(r.key)}
                >
                  <View style={[styles.radio, reason === r.key && styles.radioActive]} />
                  <Text style={[styles.reasonText, reason === r.key && styles.reasonTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.submitBtn, !reason && styles.submitBtnDisabled]}
                onPress={() => reason && setStep('report_details')}
                disabled={!reason}
              >
                <Text style={styles.submitText}>Siguiente</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Detalles opcionales */}
          {step === 'report_details' && (
            <>
              <Text style={styles.title}>Detalles adicionales</Text>
              <Text style={styles.subtitle}>Opcional — ayuda a revisar más rápido</Text>
              <TextInput
                style={styles.detailsInput}
                placeholder="Describí qué pasó..."
                placeholderTextColor={colors.muted}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={500}
              />
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitReport} disabled={loading}>
                {loading
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.submitText}>Enviar reporte</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* Confirmación */}
          {step === 'done' && (
            <>
              <Text style={styles.doneEmoji}>✅</Text>
              <Text style={styles.title}>Reporte enviado</Text>
              <Text style={styles.subtitle}>Gracias. Nuestro equipo va a revisar el caso en menos de 24 horas.</Text>
              <TouchableOpacity style={styles.submitBtn} onPress={handleClose}>
                <Text style={styles.submitText}>Cerrar</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  title:    { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: spacing.lg },
  doneEmoji:{ fontSize: 40, textAlign: 'center', marginBottom: spacing.md },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuItemDanger: {},
  menuIcon: { fontSize: 20 },
  menuText: { fontSize: 15, color: colors.text },
  menuTextDanger: { color: '#ef4444' },

  cancelBtn:  { marginTop: spacing.md, alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: colors.muted, fontSize: 15 },

  reasonItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  reasonItemActive: {},
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: colors.muted,
  },
  radioActive:      { borderColor: colors.purple, backgroundColor: colors.purple },
  reasonText:       { fontSize: 14, color: colors.text },
  reasonTextActive: { color: colors.purple, fontWeight: '600' },

  detailsInput: {
    backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.text,
    fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: spacing.lg,
  },
  submitBtn: {
    marginTop: spacing.md, backgroundColor: colors.purple,
    borderRadius: radius.full, paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText:        { color: colors.white, fontWeight: '700', fontSize: 15 },
})
