import { router } from 'expo-router'
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { profileApi } from '../services/api'
import { useAuthStore } from '../store/auth.store'

const GENDERS = ['Mujer cis', 'Hombre cis', 'Mujer trans', 'Hombre trans', 'No-binarie', 'Género fluido', 'Agénere', 'Dos espíritus', 'Otro']
const ORIENTATIONS = ['Lesbiana', 'Gay', 'Bisexual', 'Pansexual', 'Queer', 'Asexual', 'Demisexual', 'Heteroflexible', 'Otro']
const PRONOUNS = ['ella/la', 'él/lo', 'elle/le', 'they/them', 'cualquiera']
const LOOKING_FOR = [
  { v: 'relationship', l: 'Relación seria' },
  { v: 'dates',        l: 'Citas' },
  { v: 'friendship',   l: 'Amistad' },
  { v: 'networking',   l: 'Networking' },
  { v: 'casual',       l: 'Algo casual' },
  { v: 'community',    l: 'Comunidad' },
]
const INTERESTS = [
  '🎵 Música', '🎨 Arte', '📚 Libros', '🎬 Cine', '🌿 Naturaleza',
  '🏋️ Deporte', '✈️ Viajes', '🍕 Gastronomía', '🎮 Gaming', '🧘 Bienestar',
  '🐾 Mascotas', '💃 Baile', '🌈 Activismo', '🎭 Teatro', '📸 Fotografía',
]

function Chips({ options, selected, onToggle, label, max }: {
  options: string[], selected: string[], onToggle: (v: string) => void, label: string, max?: number
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(o => {
          const active = selected.includes(o)
          const disabled = !active && max !== undefined && selected.length >= max
          return (
            <TouchableOpacity
              key={o}
              style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
              onPress={() => !disabled && onToggle(o)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function Radio({ options, selected, onSelect, label }: { options: string[], selected: string, onSelect: (v: string) => void, label: string }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(o => (
          <TouchableOpacity key={o} style={[styles.chip, selected === o && styles.chipActive]} onPress={() => onSelect(o)}>
            <Text style={[styles.chipText, selected === o && styles.chipTextActive]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

export default function EditProfileScreen() {
  const { profile, setProfile } = useAuthStore()

  const [displayName, setDisplayName] = useState(profile?.displayName    ?? '')
  const [bio,         setBio]         = useState(profile?.bio            ?? '')
  const [city,        setCity]        = useState(profile?.city           ?? '')
  const [gender,      setGender]      = useState(profile?.genderIdentity ?? '')
  const [orientation, setOrientation] = useState(profile?.sexualOrientation ?? '')
  const [pronouns,    setPronouns]    = useState<string[]>((profile as any)?.pronouns ?? [])
  const [lookingFor,  setLookingFor]  = useState<string[]>(profile?.lookingFor ?? [])
  const [interests,   setInterests]   = useState<string[]>((profile as any)?.interests ?? [])
  const [loading,     setLoading]     = useState(false)

  function toggleArr(arr: string[], val: string, set: (a: string[]) => void) {
    set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val])
  }

  async function handleSave() {
    if (!displayName.trim()) { Alert.alert('Error', 'El nombre es requerido'); return }
    setLoading(true)
    try {
      const { data } = await profileApi.update({
        displayName: displayName.trim(),
        bio:         bio.trim() || null,
        city:        city.trim() || null,
        genderIdentity:    gender,
        sexualOrientation: orientation,
        pronouns,
        lookingFor,
        interests,
      })
      setProfile(data.data)
      Alert.alert('¡Guardado!', 'Tu perfil fue actualizado.')
      router.back()
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'No se pudo guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Editar perfil</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveBtnText}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        {/* Nombre */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Nombre</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} maxLength={30} />
        </View>

        {/* Bio */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={bio} onChangeText={setBio}
            placeholder="Contá algo sobre vos..." placeholderTextColor={colors.muted}
            multiline maxLength={300}
          />
          <Text style={styles.charCount}>{bio.length}/300</Text>
        </View>

        {/* Ciudad */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Ciudad</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Buenos Aires" placeholderTextColor={colors.muted} />
        </View>

        <Radio options={GENDERS}       selected={gender}      onSelect={setGender}      label="Identidad de género" />
        <Radio options={ORIENTATIONS}  selected={orientation} onSelect={setOrientation} label="Orientación sexual" />

        <Chips
          options={PRONOUNS} selected={pronouns}
          onToggle={v => toggleArr(pronouns, v, setPronouns)}
          label="Pronombres" max={2}
        />

        <Chips
          options={LOOKING_FOR.map(o => o.l)} selected={lookingFor.map(v => LOOKING_FOR.find(o => o.v === v)?.l ?? v)}
          onToggle={label => {
            const val = LOOKING_FOR.find(o => o.l === label)?.v ?? label
            toggleArr(lookingFor, val, setLookingFor)
          }}
          label="Busco" max={4}
        />

        <Chips
          options={INTERESTS} selected={interests}
          onToggle={v => toggleArr(interests, v, setInterests)}
          label="Intereses (máx. 8)" max={8}
        />
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
  },
  backBtn:    { width: 36, alignItems: 'flex-start' },
  backText:   { fontSize: 22, color: colors.muted },
  title:      { fontSize: 18, fontWeight: '800', color: colors.text },
  saveBtn:    { backgroundColor: colors.purple, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 7 },
  saveBtnText:{ color: colors.white, fontWeight: '700', fontSize: 13 },

  form:        { paddingHorizontal: spacing.lg },
  fieldBlock:  { marginBottom: spacing.lg },
  fieldLabel:  { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, fontWeight: '700' },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.text, fontSize: 15,
  },
  inputMulti:  { minHeight: 90, textAlignVertical: 'top' },
  charCount:   { fontSize: 11, color: colors.muted, textAlign: 'right', marginTop: 4 },

  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card2,
  },
  chipActive:      { borderColor: colors.purple, backgroundColor: 'rgba(168,85,247,0.15)' },
  chipDisabled:    { opacity: 0.35 },
  chipText:        { fontSize: 13, color: colors.muted },
  chipTextActive:  { color: colors.purple, fontWeight: '600' },
})
