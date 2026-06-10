import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, PanResponder, Dimensions, Image,
  ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, radius } from '../utils/theme'
import { discoverApi, likesApi } from '../services/api'
import { updateLocation } from '../hooks/useLocation'
import { useAuthStore } from '../store/auth.store'

const SCREEN_W = Dimensions.get('window').width
const SWIPE_THRESHOLD = SCREEN_W * 0.28

interface Profile {
  userId: string
  displayName: string
  age: number
  bio: string | null
  genderIdentity: string
  lookingFor: string[]
  photos: { url: string }[]
  city: string
  distanceKm: number
  isVerified: boolean
  likedYou: boolean
}

interface Filters {
  radiusKm: number
  minAge: number
  maxAge: number
}

const DEFAULT_FILTERS: Filters = { radiusKm: 25, minAge: 18, maxAge: 45 }
const RADIUS_OPTIONS  = [5, 10, 25, 50, 100]
const AGE_MIN_OPTIONS = [18, 20, 25, 30]
const AGE_MAX_OPTIONS = [25, 30, 35, 40, 45, 55, 99]

export default function DiscoverScreen() {
  const { user }                 = useAuthStore()
  const isPlus                   = user?.subscriptionTier !== 'free'

  const [profiles, setProfiles]   = useState<Profile[]>([])
  const [index, setIndex]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [swiping, setSwiping]     = useState<'like' | 'pass' | null>(null)
  const [needsLocation, setNeedsLocation] = useState(false)
  const [lastProfile, setLastProfile] = useState<Profile | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters]     = useState<Filters>(DEFAULT_FILTERS)
  const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS)

  const pan      = useRef(new Animated.ValueXY()).current
  const rotation = pan.x.interpolate({ inputRange: [-SCREEN_W, SCREEN_W], outputRange: ['-18deg', '18deg'] })
  const likeOpacity = pan.x.interpolate({ inputRange: [0, SCREEN_W * 0.2], outputRange: [0, 1], extrapolate: 'clamp' })
  const passOpacity = pan.x.interpolate({ inputRange: [-SCREEN_W * 0.2, 0], outputRange: [1, 0], extrapolate: 'clamp' })

  useEffect(() => { loadProfiles() }, [])

  async function loadProfiles(f: Filters = filters) {
    setLoading(true)
    setNeedsLocation(false)
    try {
      const { data } = await discoverApi.getFeed({ radiusKm: f.radiusKm, minAge: f.minAge, maxAge: f.maxAge, page: 1 })
      setProfiles(data.data.profiles)
      setIndex(0)
      setLastProfile(null)
    } catch (err: any) {
      const msg: string = err.response?.data?.error ?? ''
      if (err.response?.data?.upgradeRequired) {
        Alert.alert('Limite alcanzado', 'Actualizate a Plus para likes ilimitados.', [
          { text: 'Ver Plus', onPress: () => router.push('/upgrade') },
          { text: 'Cancelar', style: 'cancel' },
        ])
      } else if (msg.includes('ubicacion') || msg.includes('ubicación')) {
        setNeedsLocation(true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleEnableLocation() {
    setLoading(true)
    const loc = await updateLocation()
    if (loc) {
      await loadProfiles()
    } else {
      setLoading(false)
      Alert.alert('Permiso denegado', 'Alas necesita tu ubicacion para mostrarte perfiles cercanos.')
    }
  }

  function applyFilters() {
    setFilters(pendingFilters)
    setShowFilters(false)
    loadProfiles(pendingFilters)
  }

  function handleRewind() {
    if (!lastProfile) return
    if (!isPlus) {
      Alert.alert('Funcion Plus', 'El rewind es una funcion de Alas Plus.', [
        { text: 'Ver Plus', onPress: () => router.push('/upgrade') },
        { text: 'Cancelar', style: 'cancel' },
      ])
      return
    }
    setProfiles(prev => [lastProfile, ...prev.slice(index)])
    setIndex(0)
    setLastProfile(null)
    pan.setValue({ x: 0, y: 0 })
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gesture) => {
      pan.setValue({ x: gesture.dx, y: gesture.dy })
      if (gesture.dx > 30) setSwiping('like')
      else if (gesture.dx < -30) setSwiping('pass')
      else setSwiping(null)
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD)       { swipe('like') }
      else if (gesture.dx < -SWIPE_THRESHOLD) { swipe('pass') }
      else {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start()
        setSwiping(null)
      }
    },
  })

  async function swipe(action: 'like' | 'pass' | 'super') {
    const current = profiles[index]
    if (!current) return

    setLastProfile(current)

    const toX = action === 'pass' ? -SCREEN_W * 1.5 : SCREEN_W * 1.5
    Animated.timing(pan, { toValue: { x: toX, y: 0 }, duration: 250, useNativeDriver: false }).start(() => {
      pan.setValue({ x: 0, y: 0 })
      setSwiping(null)
      setIndex(prev => prev + 1)
    })

    try {
      const res = await likesApi.create(current.userId, action)
      if (res.data.data.match) {
        setTimeout(() => {
          Alert.alert('Es un match! 💜', 'Vos y ' + current.displayName + ' se gustaron mutuamente.')
        }, 300)
      }
    } catch (err: any) {
      if (err.response?.data?.upgradeRequired) {
        setTimeout(() => {
          Alert.alert('Limite alcanzado', err.response.data.error, [
            { text: 'Ver Plus', onPress: () => router.push('/upgrade') },
            { text: 'Cancelar', style: 'cancel' },
          ])
        }, 300)
      }
    }
  }

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.purple} />
    </View>
  )

  if (needsLocation) return (
    <View style={styles.centered}>
      <Text style={{ fontSize: 40 }}>📍</Text>
      <Text style={styles.emptyTitle}>Necesitamos tu ubicacion</Text>
      <Text style={styles.emptySub}>Alas usa tu ubicacion para mostrarte personas cercanas.</Text>
      <TouchableOpacity style={styles.reloadBtn} onPress={handleEnableLocation}>
        <Text style={styles.reloadText}>Habilitar ubicacion</Text>
      </TouchableOpacity>
    </View>
  )

  const current = profiles[index]

  if (!current) return (
    <View style={styles.centered}>
      <Text style={{ fontSize: 40 }}>🔍</Text>
      <Text style={styles.emptyTitle}>Exploraste todo por ahora</Text>
      <Text style={styles.emptySub}>Volve mas tarde o amplia el radio de busqueda</Text>
      <TouchableOpacity style={styles.reloadBtn} onPress={() => loadProfiles()}>
        <Text style={styles.reloadText}>Buscar de nuevo</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Alas</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/likes-received')}>
            <Text style={styles.iconEmoji}>💜</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { setPendingFilters(filters); setShowFilters(true) }}>
            <Text style={styles.iconEmoji}>🔧</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/upgrade')}>
            <Text style={styles.iconEmoji}>⚡</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tarjeta */}
      <Animated.View
        style={[styles.card, {
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: rotation }]
        }]}
        {...panResponder.panHandlers}
      >
        {current.photos?.[0]?.url ? (
          <Image source={{ uri: current.photos[0].url }} style={styles.cardPhoto} />
        ) : (
          <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
            <Text style={{ fontSize: 40 }}>👤</Text>
          </View>
        )}

        <Animated.View style={[styles.swipeLabel, styles.likeLabel, { opacity: likeOpacity }]}>
          <Text style={styles.swipeLabelText}>💜 ME GUSTA</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeLabel, styles.passLabel, { opacity: passOpacity }]}>
          <Text style={styles.swipeLabelText}>X PASO</Text>
        </Animated.View>

        <View style={styles.cardInfo}>
          {current.isVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>verificada</Text>
            </View>
          )}
          {current.likedYou && (
            <View style={styles.likedYouBadge}>
              <Text style={styles.likedYouText}>💜 le gustas</Text>
            </View>
          )}
          <Text style={styles.cardName}>{current.displayName}, {current.age}</Text>
          <Text style={styles.cardLocation}>📍 {current.city} · {current.distanceKm}km</Text>
          {current.bio && <Text style={styles.cardBio} numberOfLines={2}>{current.bio}</Text>}
          <View style={styles.cardTags}>
            <View style={styles.tag}><Text style={styles.tagText}>{current.genderIdentity}</Text></View>
            {current.lookingFor?.slice(0, 2).map(lf => (
              <View key={lf} style={styles.tag}><Text style={styles.tagText}>{lf}</Text></View>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Botones */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rewindBtn, !lastProfile && styles.actionBtnDisabled]}
          onPress={handleRewind}
        >
          <Text style={styles.actionEmoji}>↩</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={() => swipe('pass')}>
          <Text style={styles.actionEmoji}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.superBtn]} onPress={() => swipe('super')}>
          <Text style={styles.actionEmoji}>★</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={() => swipe('like')}>
          <Text style={styles.actionEmoji}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de filtros */}
      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Filtros de busqueda</Text>

            <Text style={styles.filterLabel}>Radio de busqueda</Text>
            <View style={styles.optionRow}>
              {RADIUS_OPTIONS.map(km => (
                <TouchableOpacity
                  key={km}
                  style={[styles.optionBtn, pendingFilters.radiusKm === km && styles.optionBtnActive]}
                  onPress={() => setPendingFilters(f => ({ ...f, radiusKm: km }))}
                >
                  <Text style={[styles.optionText, pendingFilters.radiusKm === km && styles.optionTextActive]}>
                    {km}km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Edad minima</Text>
            <View style={styles.optionRow}>
              {AGE_MIN_OPTIONS.map(age => (
                <TouchableOpacity
                  key={age}
                  style={[styles.optionBtn, pendingFilters.minAge === age && styles.optionBtnActive]}
                  onPress={() => setPendingFilters(f => ({ ...f, minAge: age }))}
                >
                  <Text style={[styles.optionText, pendingFilters.minAge === age && styles.optionTextActive]}>
                    {age}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Edad maxima</Text>
            <View style={styles.optionRow}>
              {AGE_MAX_OPTIONS.map(age => (
                <TouchableOpacity
                  key={age}
                  style={[styles.optionBtn, pendingFilters.maxAge === age && styles.optionBtnActive]}
                  onPress={() => setPendingFilters(f => ({ ...f, maxAge: age }))}
                >
                  <Text style={[styles.optionText, pendingFilters.maxAge === age && styles.optionTextActive]}>
                    {age === 99 ? '99+' : String(age)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFilters(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                <Text style={styles.applyBtnText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.bg },
  centered:   { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
  },
  logo:         { fontSize: 22, fontWeight: '900', color: colors.primary },
  headerIcons:  { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 36, height: 36, backgroundColor: colors.card,
    borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  iconEmoji: { fontSize: 16 },
  card: {
    marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: 'hidden',
    flex: 1, maxHeight: '65%', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  cardPhoto:            { width: '100%', height: '65%' },
  cardPhotoPlaceholder: { backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  swipeLabel: {
    position: 'absolute', top: 40, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: radius.sm, borderWidth: 2,
  },
  likeLabel:      { left: 20, borderColor: colors.purple, backgroundColor: 'rgba(168,85,247,0.15)' },
  passLabel:      { right: 20, borderColor: colors.muted, backgroundColor: 'rgba(255,255,255,0.1)' },
  swipeLabelText: { fontWeight: '900', fontSize: 14, color: colors.white, letterSpacing: 1 },
  cardInfo:   { padding: spacing.md, gap: 4 },
  verifiedBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(34,211,200,0.15)',
    borderWidth: 1, borderColor: colors.teal, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  verifiedText:  { fontSize: 10, color: colors.teal },
  likedYouBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1, borderColor: colors.purple, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  likedYouText:  { fontSize: 10, color: colors.purple },
  cardName:      { fontSize: 20, fontWeight: '800', color: colors.text },
  cardLocation:  { fontSize: 12, color: colors.muted },
  cardBio:       { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 2 },
  cardTags:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText:    { fontSize: 11, color: colors.muted },
  actions:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  actionBtn: {
    width: 52, height: 52, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  actionBtnDisabled: { opacity: 0.3 },
  rewindBtn:  { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: colors.amber, width: 42, height: 42 },
  passBtn:    { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: colors.border },
  likeBtn:    { backgroundColor: 'rgba(255,77,109,0.12)',  borderColor: colors.primary },
  superBtn:   { backgroundColor: 'rgba(168,85,247,0.12)', borderColor: colors.purple },
  actionEmoji:{ fontSize: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  reloadBtn: {
    marginTop: spacing.lg, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  reloadText: { color: colors.purple, fontWeight: '600' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg,
  },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  filterLabel:  { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.md },
  optionRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card2,
  },
  optionBtnActive: { borderColor: colors.purple, backgroundColor: 'rgba(168,85,247,0.12)' },
  optionText:      { fontSize: 13, color: colors.muted },
  optionTextActive:{ color: colors.purple, fontWeight: '600' },
  modalActions:  { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { color: colors.muted, fontWeight: '600' },
  applyBtn: {
    flex: 2, backgroundColor: colors.purple,
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  applyBtnText: { color: colors.white, fontWeight: '700' },
})
