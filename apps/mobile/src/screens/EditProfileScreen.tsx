import { router } from 'expo-router'
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { useAuthStore } from '../store/auth.store'
import { profileApi } from '../services/api'

const GENDER_OPTIONS = [
  'Mujer cis', 'Hombre cis', 'Mujer trans', 'Hombre trans',
  'No-binarie', 'Género fluido', 'Queer', 'Agénero',
]
const ORIENTATION_OPTIONS = [
  'Gay', 'Lesbiana', 'Bisexual', 'Pansexual', 'Queer', 'Asexual', 'Demisexual',
]
const LOOKING_FOR_OPTIONS = [
  { value: 'relationship', label: 'Relación' },
  { value: 'dates',        label: 'Citas'    },
  { value: 'friendship',   label: 'Amistad'  },
  { value: 'casual',       label: 'Casual'   },
]

export default function EditProfileScreen() {
  const { profile, setProfile } = useAuthStore()
  const [displayName,  setDisplayName]  = useState(profile?.displayName  ?? '')
  const [bio,          setBio]          = useState(profile?.bio           ?? '')
  const [city,         setCity]         = useState(profile?.city          ?? '')
  const [gender,       setGender]       = useState(profile?.genderIdentity    ?? '')
  const [orientation,  setOrientation]  = useState(profile?.sexualOrientation ?? '')
  const [lookingFor,   setLookingFor]   = useState<string[]>(profile?.lookingFor ?? [])
  const [loading,      setLoading]      = useState(false)

  function toggleLookingFor(val: string) {
    setLookingFor(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  async function handleSave() {
    if (!displayName.trim()) return Alert.alert('El nombre no puede estar vacío')
    setLoading(true)
    try {
      const { data } = await profileApi.update({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        city: city.trim(),
        genderIdentity: gender,
        sexualOrientation: orientation,
        lookingFor,
      })
      setProfile(data.data)
      Alert.alert('¡Guardado!', 'Tu perfil fue actualizado.', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'No se pudo guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Editar perfil</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
          {loading
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.saveBtnText}>Guardar</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Nombre */}
      <Text style={styles.label}>Nombre en Alas</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName}
        placeholder="Cómo querés que te llamen" placeholderTextColor={colors.muted}
        maxLength={30} />
      <Text style={styles.hint}>{displayName.length}/30</Text>

      {/* Bio */}
      <Text style={styles.label}>Bio</Text>
      <TextInput style={[styles.input, styles.inputMultiline]} value={bio} onChangeText={setBio}
        placeholder="Contá algo sobre vos..." placeholderTextColor={colors.muted}
        multiline maxLength={300} />
      <Text style={styles.hint}>{bio.length}/300</Text>

      {/* Ciudad */}
      <Text style={styles.label}>Ciudad</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity}
        placeholder="Ej: Buenos Aires" placeholderTextColor={colors.muted} />

      {/* Género */}
      <Text style={styles.label}>Identidad de género</Text>
      <View style={styles.pills}>
        {GENDER_OPTIONS.map(g => (
          <TouchableOpacity key={g} style={[styles.pill, gender === g && styles.pillActive]}
            onPress={() => setGender(g)}>
            <Text style={[styles.pillText, gender === g && styles.pillTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Orientación */}
      <Text style={[styles.label, { marginTop: spacing.lg }]}>Orientación sexual</Text>
      <View style={styles.pills}>
        {ORIENTATION_OPTIONS.map(o => (
          <TouchableOpacity key={o} style={[styles.pill, orientation === o && styles.pillActive]}
            onPress={() => setOrientation(o)}>
            <Text style={[styles.pillText, orientation === o && styles.pillTextActive]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Qué buscás */}
      <Text style={[styles.label, { marginTop: spacing.lg }]}>¿Qué buscás?</Text>
      <View style={styles.pills}>
        {LOOKING_FOR_OPTIONS.map(opt => (
          <TouchableOpacity key={opt.value}
            style={[styles.pillLarge, lookingFor.includes(opt.value) && styles.pillActive]}
            onPress={() => toggleLookingFor(opt.value)}>
            <Text style={[styles.pillText, lookingFor.includes(opt.value) && styles.pillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.bg },
  content:    { padding: spacing.lg, paddingTop: 56 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  backBtn:    { padding: 4, marginRight: spacing.sm },
  backText:   { fontSize: 28, color: colors.muted, lineHeight: 30 },
  title:      { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  saveBtn: {
    backgroundColor: colors.purple, borderRadius: radius.sm,
    paddingHorizontal: 16, paddingVertical: 7, minWidth: 70, alignItems: 'center',
  },
  saveBtnText:    { color: colors.white, fontWeight: '700', fontSize: 13 },
  label:          { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: spacing.md },
  hint:           { fontSize: 11, color: colors.muted, textAlign: 'right', marginTop: 4 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: 15,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  pills:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7,
  },
  pillLarge: {
    backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 10,
  },
  pillActive:     { backgroundColor: 'rgba(168,85,247,0.15)', borderColor: colors.purple },
  pillText:       { fontSize: 13, color: colors.muted },
  pillTextActive: { color: colors.purple, fontWeight: '600' },
})
