import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, PanResponder, Dimensions, Image,
  ActivityIndicator, Alert,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { discoverApi, likesApi } from '../services/api'

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

export default function DiscoverScreen() {
  const [profiles, setProfiles]   = useState<Profile[]>([])
  const [index, setIndex]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [swiping, setSwiping]     = useState<'like' | 'pass' | null>(null)

  const pan      = useRef(new Animated.ValueXY()).current
  const rotation = pan.x.interpolate({ inputRange: [-SCREEN_W, SCREEN_W], outputRange: ['-18deg', '18deg'] })
  const likeOpacity = pan.x.interpolate({ inputRange: [0, SCREEN_W * 0.2], outputRange: [0, 1], extrapolate: 'clamp' })
  const passOpacity = pan.x.interpolate({ inputRange: [-SCREEN_W * 0.2, 0], outputRange: [1, 0], extrapolate: 'clamp' })

  useEffect(() => { loadProfiles() }, [])

  async function loadProfiles() {
    setLoading(true)
    try {
      const { data } = await discoverApi.getFeed({ radiusKm: 25, page: 1 })
      setProfiles(data.data.profiles)
      setIndex(0)
    } catch (err: any) {
      if (err.response?.data?.upgradeRequired) {
        Alert.alert('Límite alcanzado', 'Actualizá a Plus para likes ilimitados.')
      }
    } finally {
      setLoading(false)
    }
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD)  { swipe('like') }
      else if (gesture.dx < -SWIPE_THRESHOLD) { swipe('pass') }
      else {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start()
        setSwiping(null)
      }
    },
    onPanResponderMove: (_, gesture) => {
      pan.setValue({ x: gesture.dx, y: gesture.dy })
      if (gesture.dx > 30) setSwiping('like')
      else if (gesture.dx < -30) setSwiping('pass')
      else setSwiping(null)
    },
  })

  async function swipe(action: 'like' | 'pass' | 'super') {
    const current = profiles[index]
    if (!current) return

    // Animar la tarjeta fuera de pantalla
    const toX = action === 'pass' ? -SCREEN_W * 1.5 : SCREEN_W * 1.5
    Animated.timing(pan, { toValue: { x: toX, y: 0 }, duration: 250, useNativeDriver: false }).start(() => {
      pan.setValue({ x: 0, y: 0 })
      setSwiping(null)
      setIndex(prev => prev + 1)
    })

    // Llamar a la API
    try {
      const res = await likesApi.create(current.userId, action)
      if (res.data.data.match) {
        Alert.alert('¡Es un match! 💜', `Vos y ${current.displayName} se gustaron mutuamente.`)
      }
    } catch (err: any) {
      if (err.response?.data?.upgradeRequired) {
        Alert.alert('Límite de likes', 'Actualizá a Plus para continuar.')
      }
    }
  }

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.purple} />
    </View>
  )

  const current = profiles[index]

  if (!current) return (
    <View style={styles.centered}>
      <Text style={{ fontSize: 40 }}>🔍</Text>
      <Text style={styles.emptyTitle}>Exploraste todo por ahora</Text>
      <Text style={styles.emptySub}>Volvé más tarde o ampliá el radio de búsqueda</Text>
      <TouchableOpacity style={styles.reloadBtn} onPress={loadProfiles}>
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
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={styles.iconEmoji}>🔧</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={styles.iconEmoji}>⚡</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tarjeta de perfil */}
      <Animated.View
        style={[styles.card, {
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: rotation }]
        }]}
        {...panResponder.panHandlers}
      >
        {/* Foto */}
        {current.photos?.[0]?.url ? (
          <Image source={{ uri: current.photos[0].url }} style={styles.cardPhoto} />
        ) : (
          <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
            <Text style={{ fontSize: 40 }}>👤</Text>
          </View>
        )}

        {/* Overlay LIKE */}
        <Animated.View style={[styles.swipeLabel, styles.likeLabel, { opacity: likeOpacity }]}>
          <Text style={styles.swipeLabelText}>💜 ME GUSTA</Text>
        </Animated.View>

        {/* Overlay PASS */}
        <Animated.View style={[styles.swipeLabel, styles.passLabel, { opacity: passOpacity }]}>
          <Text style={styles.swipeLabelText}>✕ PASO</Text>
        </Animated.View>

        {/* Info */}
        <View style={styles.cardInfo}>
          {current.isVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ verificada</Text>
            </View>
          )}
          {current.likedYou && (
            <View style={styles.likedYouBadge}>
              <Text style={styles.likedYouText}>💜 le gustás</Text>
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

      {/* Botones de acción */}
      <View style={styles.actions}>
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
    flex: 1, maxHeight: '68%', backgroundColor: colors.card,
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
  actions:    { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, padding: spacing.lg },
  actionBtn: {
    width: 56, height: 56, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  passBtn:    { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: colors.border },
  likeBtn:    { backgroundColor: 'rgba(255,77,109,0.12)',  borderColor: colors.primary },
  superBtn:   { backgroundColor: 'rgba(168,85,247,0.12)', borderColor: colors.purple },
  actionEmoji:{ fontSize: 22 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  reloadBtn: {
    marginTop: spacing.lg, backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  reloadText: { color: colors.purple, fontWeight: '600' },
})
