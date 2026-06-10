import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, radius } from '../utils/theme'
import { likesReceivedApi, likesApi } from '../services/api'
import { useAuthStore } from '../store/auth.store'

interface LikedUser {
  likeId: string
  action: 'like' | 'super'
  createdAt: string
  user: {
    userId: string
    displayName: string
    age: number
    bio: string | null
    photos: { url: string }[]
    city: string
    countryCode: string
    isVerified: boolean
    genderIdentity: string
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function LikesReceivedScreen() {
  const { user } = useAuthStore()
  const isPlus = user?.subscriptionTier !== 'free'

  const [likes, setLikes]         = useState<LikedUser[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [acting, setActing]       = useState<string | null>(null)

  useEffect(() => { loadLikes() }, [])

  async function loadLikes() {
    setLoading(true)
    try {
      const { data } = await likesReceivedApi.getReceived()
      setLikes(data.data.likes)
    } catch (err: any) {
      if (err.response?.data?.upgradeRequired) {
        // manejado abajo en el render
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleAction(item: LikedUser, action: 'like' | 'pass') {
    setActing(item.likeId)
    try {
      const res = await likesApi.create(item.user.userId, action)
      setLikes(prev => prev.filter(l => l.likeId !== item.likeId))
      if (res.data.data.match) {
        Alert.alert('Es un match! 💜', `Vos y ${item.user.displayName} se gustaron mutuamente. Empezá a chatear.`)
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'No se pudo procesar')
    } finally {
      setActing(null)
    }
  }

  // ── Paywall para free users ─────────────────────────────────────────────────
  if (!isPlus) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Te gustaron</Text>
        </View>

        <View style={styles.paywallContainer}>
          <View style={styles.paywallBlur}>
            {/* Siluetas borrosas de ejemplo */}
            {[1,2,3,4,5,6].map(i => (
              <View key={i} style={styles.blurCard}>
                <View style={styles.blurAvatar} />
                <View style={styles.blurLine} />
                <View style={[styles.blurLine, { width: '60%' }]} />
              </View>
            ))}
          </View>
          <View style={styles.paywallOverlay}>
            <Text style={styles.paywallEmoji}>💜</Text>
            <Text style={styles.paywallTitle}>¿Quién te gustó?</Text>
            <Text style={styles.paywallSub}>
              Con Alas Plus ves exactamente quiénes ya te dieron like. Dales like de vuelta y es match instantáneo.
            </Text>
            <TouchableOpacity style={styles.paywallBtn} onPress={() => router.push('/upgrade')}>
              <Text style={styles.paywallBtnText}>Ver con Plus ⚡</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  // ── Pantalla Plus ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Te gustaron</Text>
        {likes.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{likes.length}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.purple} />
        </View>
      ) : likes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 40 }}>🪶</Text>
          <Text style={styles.emptyTitle}>Nadie por ahora</Text>
          <Text style={styles.emptySub}>Seguí explorando para generar más conexiones</Text>
        </View>
      ) : (
        <FlatList
          data={likes}
          keyExtractor={l => l.likeId}
          numColumns={2}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLikes() }} tintColor={colors.purple} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.user.photos?.[0]?.url ? (
                <Image source={{ uri: item.user.photos[0].url }} style={styles.cardPhoto} />
              ) : (
                <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
                  <Text style={{ fontSize: 32 }}>👤</Text>
                </View>
              )}

              {item.action === 'super' && (
                <View style={styles.superBadge}>
                  <Text style={styles.superBadgeText}>★ Super</Text>
                </View>
              )}

              <View style={styles.cardInfo}>
                <View style={styles.cardNameRow}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.user.displayName}, {item.user.age}
                  </Text>
                  {item.user.isVerified && <Text style={styles.verifiedDot}>✓</Text>}
                </View>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.user.city} · {timeAgo(item.createdAt)}
                </Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.passBtn}
                  onPress={() => handleAction(item, 'pass')}
                  disabled={acting === item.likeId}
                >
                  <Text style={styles.passIcon}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.likeBtn}
                  onPress={() => handleAction(item, 'like')}
                  disabled={acting === item.likeId}
                >
                  {acting === item.likeId
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.likeIcon}>♥</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const CARD_W = '47%'

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
  },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText:   { fontSize: 22, color: colors.text },
  title:      { fontSize: 20, fontWeight: '900', color: colors.text, flex: 1 },
  badge: {
    backgroundColor: colors.purple, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText:  { color: colors.white, fontSize: 12, fontWeight: '700' },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  emptySub:   { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, paddingHorizontal: spacing.xl },

  // Grid
  grid: { paddingHorizontal: spacing.lg, paddingBottom: 100, gap: spacing.md },
  card: {
    width: CARD_W, backgroundColor: colors.card,
    borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
    margin: spacing.sm / 2,
  },
  cardPhoto:            { width: '100%', aspectRatio: 3 / 4 },
  cardPhotoPlaceholder: { backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  superBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(168,85,247,0.85)', borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  superBadgeText: { fontSize: 10, color: colors.white, fontWeight: '700' },
  cardInfo:   { padding: spacing.sm },
  cardNameRow:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardName:   { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 },
  verifiedDot:{ fontSize: 10, color: colors.teal },
  cardMeta:   { fontSize: 11, color: colors.muted, marginTop: 2 },
  cardActions:{ flexDirection: 'row', padding: spacing.sm, gap: spacing.sm, paddingTop: 0 },
  passBtn: {
    flex: 1, height: 36, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  likeBtn: {
    flex: 1, height: 36, borderRadius: radius.full,
    backgroundColor: 'rgba(255,77,109,0.15)', borderWidth: 1, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  passIcon: { fontSize: 16, color: colors.muted },
  likeIcon: { fontSize: 16, color: colors.primary },

  // Paywall
  paywallContainer: { flex: 1, position: 'relative' },
  paywallBlur: {
    flexDirection: 'row', flexWrap: 'wrap', padding: spacing.lg,
    gap: spacing.md, opacity: 0.25,
  },
  blurCard: {
    width: CARD_W, aspectRatio: 0.75, backgroundColor: colors.card,
    borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, gap: spacing.sm,
    margin: spacing.sm / 2,
  },
  blurAvatar: {
    width: '100%', flex: 1, backgroundColor: colors.card2, borderRadius: radius.sm,
  },
  blurLine: {
    width: '80%', height: 10, backgroundColor: colors.card2, borderRadius: 5,
  },
  paywallOverlay: {
    position: 'absolute', inset: 0 as any,
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, backgroundColor: 'rgba(8,8,14,0.75)',
  },
  paywallEmoji:  { fontSize: 48 },
  paywallTitle:  { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  paywallSub:    { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  paywallBtn: {
    marginTop: spacing.xl, backgroundColor: colors.purple,
    borderRadius: radius.full, paddingHorizontal: spacing.xl, paddingVertical: 14,
  },
  paywallBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
})
