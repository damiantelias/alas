import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { useAuthStore } from '../store/auth.store'

const GENDER_OPTIONS = [
  'Mujer cis', 'Hombre cis', 'Mujer trans', 'Hombre trans',
  'No-binarie', 'Género fluido', 'Queer', 'Agénero',
]

const ORIENTATION_OPTIONS = [
  'Gay', 'Lesbiana', 'Bisexual', 'Pansexual',
  'Queer', 'Asexual', 'Demisexual',
]

const LOOKING_FOR_OPTIONS = [
  { value: 'relationship', label: 'Relación' },
  { value: 'dates',        label: 'Citas' },
  { value: 'friendship',   label: 'Amistad' },
  { value: 'casual',       label: 'Casual' },
]

export default function RegisterScreen({ navigation }: any) {
  const [step, setStep]               = useState(1)  // 3 pasos
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthdate, setBirthdate]     = useState('')
  const [gender, setGender]           = useState('')
  const [customGender, setCustomGender] = useState('')
  const [orientation, setOrientation] = useState('')
  const [lookingFor, setLookingFor]   = useState<string[]>([])
  const [loading, setLoading]         = useState(false)

  const register   = useAuthStore(s => s.register)

  function toggleLookingFor(val: string) {
    setLookingFor(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  async function handleFinish() {
    setLoading(true)
    try {
      await register(email.trim().toLowerCase(), password)
      // Después del registro redirige a completar perfil
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'No se pudo crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  // ── Paso 1: cuenta ──────────────────────────────────────────────────────────
  if (step === 1) return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StepIndicator current={1} total={3} />
      <Text style={styles.title}>Creá tu cuenta</Text>
      <Text style={styles.sub}>Rápido, te llevamos al mundo que te pertenece.</Text>

      <Text style={styles.label}>Tu nombre en Alas</Text>
      <TextInput style={styles.input} placeholder="Cómo querés que te llamen"
        placeholderTextColor={colors.muted} value={displayName} onChangeText={setDisplayName} />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} placeholder="tu@email.com"
        placeholderTextColor={colors.muted} value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" />

      <Text style={styles.label}>Contraseña</Text>
      <TextInput style={styles.input} placeholder="Mínimo 8 caracteres con mayúscula y número"
        placeholderTextColor={colors.muted} value={password} onChangeText={setPassword}
        secureTextEntry />

      <Text style={styles.label}>Fecha de nacimiento</Text>
      <TextInput style={styles.input} placeholder="YYYY-MM-DD  (ej: 1998-03-15)"
        placeholderTextColor={colors.muted} value={birthdate} onChangeText={setBirthdate} />

      <TouchableOpacity style={styles.btnPrimary} onPress={() => {
        if (!email || !password || !displayName || !birthdate)
          return Alert.alert('Completá todos los campos')
        setStep(2)
      }}>
        <Text style={styles.btnText}>Siguiente →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnGhost} onPress={() => navigation.goBack()}>
        <Text style={styles.btnGhostText}>Ya tengo cuenta</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  // ── Paso 2: identidad ───────────────────────────────────────────────────────
  if (step === 2) return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StepIndicator current={2} total={3} />
      <Text style={styles.title}>¿Cómo te identificás?</Text>
      <Text style={styles.sub}>Elegí lo que mejor te represente. Podés cambiarlo después.</Text>

      <Text style={styles.label}>Identidad de género</Text>
      <View style={styles.pillsContainer}>
        {GENDER_OPTIONS.map(g => (
          <TouchableOpacity key={g}
            style={[styles.pill, gender === g && styles.pillActive]}
            onPress={() => setGender(g)}>
            <Text style={[styles.pillText, gender === g && styles.pillTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput style={[styles.input, { marginTop: spacing.sm }]}
        placeholder="O escribí la tuya..."
        placeholderTextColor={colors.muted}
        value={customGender} onChangeText={v => { setCustomGender(v); setGender(v) }} />

      <Text style={[styles.label, { marginTop: spacing.lg }]}>Orientación sexual</Text>
      <View style={styles.pillsContainer}>
        {ORIENTATION_OPTIONS.map(o => (
          <TouchableOpacity key={o}
            style={[styles.pill, orientation === o && styles.pillActive]}
            onPress={() => setOrientation(o)}>
            <Text style={[styles.pillText, orientation === o && styles.pillTextActive]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.btnPrimary} onPress={() => {
        if (!gender || !orientation)
          return Alert.alert('Elegí tu identidad y orientación')
        setStep(3)
      }}>
        <Text style={styles.btnText}>Siguiente →</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  // ── Paso 3: qué buscás ──────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StepIndicator current={3} total={3} />
      <Text style={styles.title}>¿Qué buscás?</Text>
      <Text style={styles.sub}>Podés elegir más de una opción.</Text>

      <View style={styles.pillsContainer}>
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

      <View style={[styles.infoBox, { marginTop: spacing.xl }]}>
        <Text style={styles.infoText}>
          🔒 Tu información es privada. Solo compartís lo que elegís mostrar en tu perfil.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.btnPrimary, loading && styles.btnDisabled]}
        onPress={handleFinish} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.btnText}>¡Crear mi cuenta! 🪶</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.xl }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{
          flex: 1, height: 3, borderRadius: 10,
          backgroundColor: i < current ? colors.purple : colors.border,
        }} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: spacing.xl, paddingTop: spacing.xxl },
  title:     { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 6 },
  sub:       { fontSize: 14, color: colors.muted, marginBottom: spacing.lg, lineHeight: 20 },
  label:     { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: 15,
  },
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7,
  },
  pillLarge: {
    backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 12,
  },
  pillActive:     { backgroundColor: 'rgba(168,85,247,0.15)', borderColor: colors.purple },
  pillText:       { fontSize: 13, color: colors.muted },
  pillTextActive: { color: colors.purple, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.xl,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: colors.white, fontWeight: '700', fontSize: 15 },
  btnGhost:    { alignItems: 'center', padding: spacing.md },
  btnGhostText:{ color: colors.muted, fontSize: 14 },
  infoBox: {
    backgroundColor: 'rgba(168,85,247,0.08)', borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)', borderRadius: radius.md, padding: spacing.md,
  },
  infoText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
})
