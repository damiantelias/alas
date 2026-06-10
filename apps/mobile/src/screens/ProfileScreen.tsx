import { router } from 'expo-router'
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, Image, ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { colors, spacing, radius } from '../utils/theme'
import { useAuthStore } from '../store/auth.store'
import { profileApi } from '../services/api'

export default function ProfileScreen() {
  const { user, profile, setProfile, logout } = useAuthStore()
  const [incognito, setIncognito] = useState(profile?.isIncognito ?? false)
  const [showDistance, setShowDistance] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      return Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir fotos.')
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    setUploadingPhoto(true)
    try {
      const { data } = await profileApi.uploadPhoto(asset.uri, asset.mimeType ?? 'image/jpeg')
      setProfile({ ...profile!, photos: data.data.photos })
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'No se pudo subir la foto')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleDeletePhoto(url: string) {
    Alert.alert('Eliminar foto', '¿Seguro que querés borrar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          const { data } = await profileApi.deletePhoto(url)
          setProfile({ ...profile!, photos: data.data.photos })
        } catch {
          Alert.alert('Error', 'No se pudo eliminar la foto')
        }
      }},
    ])
  }

  async function toggleIncognito(val: boolean) {
    setIncognito(val)
    try {
      await profileApi.toggleIncognito(val)
    } catch {
      setIncognito(!val)
      Alert.alert('Error', 'No se pudo actualizar la configuración')
    }
  }

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ])
  }

  const photo = profile?.photos?.[0]?.url

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header con foto */}
      <View style={styles.headerBg}>
        <View style={styles.headerGlow} />
        <View style={styles.headerContent}>
          <View style={styles.avatarWrap}>
            {photo
              ? <Image source={{ uri: photo }} style={styles.avatar} />
              : <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={{ fontSize: 36 }}>👤</Text>
                </View>
            }
            <TouchableOpacity style={styles.avatarEditBtn} onPress={handlePickPhoto} disabled={uploadingPhoto}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.avatarEditText}>+</Text>
              }
            </TouchableOpacity>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>
              {profile?.displayName ?? user?.email?.split('@')[0]}, {profile?.age}
            </Text>
            <Text style={styles.location}>📍 {profile?.city ?? 'Sin ubicación'}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}
            onPress={() => router.push('/edit-profile')}>
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>

        {/* Identidad */}
        <View style={styles.tagsRow}>
          {profile?.genderIdentity && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{profile.genderIdentity}</Text>
            </View>
          )}
          {profile?.lookingFor?.map(lf => (
            <View key={lf} style={[styles.tag, styles.tagOrange]}>
              <Text style={[styles.tagText, { color: colors.primary }]}>{lf}</Text>
            </View>
          ))}
        </View>

        {/* Bio */}
        {profile?.bio && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>—</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>—</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{profile?.isVerified ? '✓' : '○'}</Text>
            <Text style={styles.statLabel}>Verificado</Text>
          </View>
        </View>

        {/* Suscripción */}
        <View style={styles.subCard}>
          <View>
            <Text style={styles.subTitle}>
              {user?.subscriptionTier === 'free' ? '🪶 Plan Free' : '⚡ Plan Plus'}
            </Text>
            <Text style={styles.subSub}>
              {user?.subscriptionTier === 'free'
                ? '10 likes por día · funciones básicas'
                : 'Likes ilimitados · modo incógnito · más'
              }
            </Text>
          </View>
          {user?.subscriptionTier === 'free' && (
            <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/upgrade')}>
              <Text style={styles.upgradeBtnText}>Plus →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Configuración */}
        <Text style={styles.sectionLabel}>Privacidad</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            label="Modo incógnito"
            sub="No aparecés en el discover de otros"
            value={incognito}
            onChange={toggleIncognito}
          />
          <SettingRow
            label="Mostrar distancia"
            sub="Los demás ven a cuántos km estás"
            value={showDistance}
            onChange={setShowDistance}
          />
        </View>

        <Text style={styles.sectionLabel}>Cuenta</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuLabel}>Verificar perfil</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuLabel}>Notificaciones</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuLabel}>Cambiar contraseña</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <Text style={styles.menuLabel}>Política de privacidad</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Alas v0.1 · hecho con 💜 en LATAM</Text>

      </View>
    </ScrollView>
  )
}

function SettingRow({ label, sub, value, onChange }: {
  label: string; sub: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.card2, true: colors.purple }}
        thumbColor={colors.white}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  headerBg: {
    paddingTop: 56, paddingBottom: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    position: 'relative', overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute', top: -40, left: '20%',
    width: 200, height: 200,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 100,
  },
  headerContent: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  avatarWrap:   { position: 'relative' },
  avatar:       { width: 72, height: 72, borderRadius: radius.full, borderWidth: 2, borderColor: colors.bg },
  avatarPlaceholder: { backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  avatarEditText: { color: colors.white, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  headerInfo:   { flex: 1 },
  name:         { fontSize: 18, fontWeight: '800', color: colors.text },
  location:     { fontSize: 12, color: colors.muted, marginTop: 2 },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtnText:  { fontSize: 12, color: colors.muted },
  body:         { padding: spacing.lg, gap: spacing.md },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(168,85,247,0.1)', borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)', borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  tagOrange: {
    backgroundColor: 'rgba(255,77,109,0.08)',
    borderColor: 'rgba(255,77,109,0.2)',
  },
  tagText:      { fontSize: 12, color: colors.purple },
  bio:          { fontSize: 14, color: colors.muted, lineHeight: 20 },
  statsRow:     { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 2,
  },
  statNum:      { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel:    { fontSize: 11, color: colors.muted },
  subCard: {
    backgroundColor: 'rgba(168,85,247,0.06)', borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)', borderRadius: radius.md,
    padding: spacing.md, flexDirectio