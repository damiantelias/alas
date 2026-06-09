import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator,
  RefreshControl, KeyboardAvoidingView, Platform, Alert, Modal,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { communityApi } from '../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Post {
  id: string
  content: string
  type: string
  likesCount: number
  likedByMe: boolean
  createdAt: string
  author: { userId: string; displayName: string; genderIdentity: string; isVerified: boolean }
}

interface Event {
  id: string
  title: string
  date: string
  city: string
  country: string
  emoji: string
  tags: string[]
  url?: string
}

interface Resource {
  id: string
  title: string
  description: string
  country: string
  emoji: string
  category: 'legal' | 'salud' | 'apoyo' | 'emergencia'
  url?: string
}

// ── Static data ───────────────────────────────────────────────────────────────

const EVENTS: Event[] = [
  { id: 'e1', title: 'Marcha del Orgullo Buenos Aires', date: '2026-11-01', city: 'Buenos Aires', country: 'AR', emoji: '🏳️‍🌈', tags: ['presencial', 'gratuito'], url: 'https://marchadelorgullo.org.ar' },
  { id: 'e2', title: 'Encuentro Trans Latinoamerica', date: '2026-08-15', city: 'Bogota', country: 'CO', emoji: '🏳️‍⚧️', tags: ['virtual', 'gratuito'] },
  { id: 'e3', title: 'Orgullo Ciudad de Mexico', date: '2026-06-27', city: 'CDMX', country: 'MX', emoji: '🌈', tags: ['presencial', 'gratuito'] },
  { id: 'e4', title: 'Feria del Libro LGBTQ+ Santiago', date: '2026-09-20', city: 'Santiago', country: 'CL', emoji: '📚', tags: ['presencial', 'cultura'] },
  { id: 'e5', title: 'Ciclo de cine queer Montevideo', date: '2026-10-05', city: 'Montevideo', country: 'UY', emoji: '🎬', tags: ['presencial', 'cultura'] },
  { id: 'e6', title: 'Orgullo Sao Paulo', date: '2026-06-14', city: 'Sao Paulo', country: 'BR', emoji: '💜', tags: ['presencial', 'gratuito'] },
]

const RESOURCES: Resource[] = [
  { id: 'r1', title: 'Federacion Argentina LGBT+', description: 'Asesoramiento legal, tramites de identidad de genero y apoyo psicosocial.', country: 'AR', emoji: '⚖️', category: 'legal', url: 'https://falgbt.org' },
  { id: 'r2', title: '100% Diversidad y Derechos', description: 'Organizacion de base con grupos de apoyo, salud sexual y ciudadania.', country: 'AR', emoji: '💜', category: 'apoyo', url: 'https://100porciento.org.ar' },
  { id: 'r3', title: 'CEJA Mexico — Identidad Legal', description: 'Guia paso a paso para cambio de identidad legal en Mexico.', country: 'MX', emoji: '📋', category: 'legal' },
  { id: 'r4', title: 'It Gets Better Latinoamerica', description: 'Recursos de salud mental, historias y linea de ayuda para jovenes LGBTQ+.', country: 'LATAM', emoji: '💙', category: 'salud', url: 'https://itgetsbetter.lat' },
  { id: 'r5', title: 'Movilh Chile — Linea de Apoyo', description: 'Orientacion legal y psicologica para personas LGBTQ+.', country: 'CL', emoji: '📞', category: 'apoyo', url: 'https://movilh.cl' },
  { id: 'r6', title: 'Abosex Colombia', description: 'Red de abogados para casos de discriminacion por orientacion sexual.', country: 'CO', emoji: '⚖️', category: 'legal' },
  { id: 'r7', title: 'Grupo Gay Bahia — Brasil', description: 'La organizacion LGBTQ+ mas antigua de America Latina.', country: 'BR', emoji: '🏳️‍🌈', category: 'apoyo', url: 'https://ggb.org.br' },
  { id: 'r8', title: 'Linea de crisis LGBTQ+ LATAM', description: 'Atencion psicologica gratuita por WhatsApp para toda la region.', country: 'LATAM', emoji: '🆘', category: 'emergencia' },
]

const CATEGORY_COLORS: Record<string, string> = {
  legal:      colors.purple,
  salud:      colors.teal,
  apoyo:      colors.primary,
  emergencia: '#ef4444',
}

const COUNTRY_FLAGS: Record<string, string> = {
  AR: '🇦🇷', MX: '🇲🇽', CO: '🇨🇴', CL: '🇨🇱', UY: '🇺🇾', BR: '🇧🇷', LATAM: '🌎',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const [tab, setTab]             = useState<'feed' | 'eventos' | 'recursos'>('feed')
  const [posts, setPosts]         = useState<Post[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newPost, setNewPost]     = useState('')
  const [posting, setPosting]     = useState(false)
  const [page, setPage]           = useState(1)
  const [hasMore, setHasMore]     = useState(true)
  const [resFilter, setResFilter] = useState<'todos' | 'legal' | 'salud' | 'apoyo' | 'emergencia'>('todos')

  useEffect(() => { if (tab === 'feed') loadPosts(1) }, [tab])

  async function loadPosts(p: number, append = false) {
    if (p === 1) setLoading(true)
    try {
      const { data } = await communityApi.getPosts(p)
      const incoming: Post[] = data.data.posts
      setPosts(prev => append ? [...prev, ...incoming] : incoming)
      setHasMore(data.data.hasMore)
      setPage(p)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadPosts(1)
  }

  async function handleSubmitPost() {
    if (!newPost.trim() || posting) return
    setPosting(true)
    try {
      await communityApi.createPost(newPost.trim())
      setNewPost('')
      await loadPosts(1)
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'No se pudo publicar')
    } finally {
      setPosting(false)
    }
  }

  async function handleLike(postId: string) {
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likedByMe ? p.likesCount - 1 : p.likesCount + 1 }
      : p
    ))
    try {
      await communityApi.likePost(postId)
    } catch {
      // revert
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likedByMe ? p.likesCount - 1 : p.likesCount + 1 }
        : p
      ))
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderPost({ item: p }: { item: Post }) {
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.postAvatar}>
            <Text style={styles.postAvatarText}>{p.author.displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.postAuthorRow}>
              <Text style={styles.postAuthorName}>{p.author.displayName}</Text>
              {p.author.isVerified && <Text style={styles.verifiedDot}>✓</Text>}
            </View>
            <Text style={styles.postMeta}>{p.author.genderIdentity} · {timeAgo(p.createdAt)}</Text>
          </View>
        </View>
        <Text style={styles.postContent}>{p.content}</Text>
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(p.id)}>
            <Text style={[styles.likeIcon, p.likedByMe && styles.likeIconActive]}>♥</Text>
            <Text style={[styles.likeCount, p.likedByMe && styles.likeCountActive]}>{p.likesCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  function renderEvent({ item: e }: { item: Event }) {
    const isPast = new Date(e.date) < new Date()
    return (
      <View style={[styles.eventCard, isPast && styles.eventCardPast]}>
        <Text style={styles.eventEmoji}>{e.emoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.eventHeaderRow}>
            <Text style={styles.eventTitle}>{e.title}</Text>
          </View>
          <Text style={styles.eventDate}>{COUNTRY_FLAGS[e.country] ?? '🌎'} {e.city} · {formatDate(e.date)}</Text>
          <View style={styles.tagRow}>
            {e.tags.map(t => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
            {isPast && <View style={[styles.tag, styles.tagPast]}><Text style={styles.tagText}>finalizado</Text></View>}
          </View>
        </View>
      </View>
    )
  }

  function renderResource({ item: r }: { item: Resource }) {
    const color = CATEGORY_COLORS[r.category] ?? colors.purple
    return (
      <View style={styles.resourceCard}>
        <View style={[styles.resourceDot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <View style={styles.resourceHeaderRow}>
            <Text style={styles.resourceEmoji}>{r.emoji}</Text>
            <Text style={styles.resourceTitle}>{r.title}</Text>
          </View>
          <Text style={styles.resourceDesc}>{r.description}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { borderColor: color + '55' }]}>
              <Text style={[styles.tagText, { color }]}>{r.category}</Text>
            </View>
            <Text style={styles.resourceCountry}>{COUNTRY_FLAGS[r.country] ?? r.country}</Text>
          </View>
        </View>
      </View>
    )
  }

  // ── Tabs content ────────────────────────────────────────────────────────────

  const filteredResources = resFilter === 'todos'
    ? RESOURCES
    : RESOURCES.filter(r => r.category === resFilter)

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Comunidad</Text>
        <Text style={styles.subtitle}>Espacio seguro para LGBTQ+ en LATAM</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['feed', 'eventos', 'recursos'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'feed' ? 'Feed' : t === 'eventos' ? 'Eventos' : 'Recursos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      {tab === 'feed' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            data={posts}
            keyExtractor={p => p.id}
            renderItem={renderPost}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.purple} />}
            ListHeaderComponent={
              <View style={styles.composeBox}>
                <TextInput
                  style={styles.composeInput}
                  placeholder="Compartí algo con la comunidad..."
                  placeholderTextColor={colors.muted}
                  value={newPost}
                  onChangeText={setNewPost}
                  multiline
                  maxLength={500}
                />
                <View style={styles.composeFooter}>
                  <Text style={styles.charCount}>{newPost.length}/500</Text>
                  <TouchableOpacity
                    style={[styles.publishBtn, (!newPost.trim() || posting) && styles.publishBtnDisabled]}
                    onPress={handleSubmitPost}
                    disabled={!newPost.trim() || posting}
                  >
                    {posting
                      ? <ActivityIndicator size="small" color={colors.white} />
                      : <Text style={styles.publishText}>Publicar</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            }
            ListEmptyComponent={
              loading
                ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.purple} />
                : <View style={styles.emptyBox}>
                    <Text style={styles.emptyEmoji}>🏳️‍🌈</Text>
                    <Text style={styles.emptyText}>Se la primera en publicar algo</Text>
                  </View>
            }
            onEndReached={() => { if (hasMore && !loading) loadPosts(page + 1, true) }}
            onEndReachedThreshold={0.3}
          />
        </KeyboardAvoidingView>
      )}

      {/* Eventos */}
      {tab === 'eventos' && (
        <FlatList
          data={EVENTS.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())}
          keyExtractor={e => e.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Eventos LGBTQ+ en LATAM</Text>
              <Text style={styles.sectionSub}>Marchas, encuentros y actividades de la comunidad</Text>
            </View>
          }
        />
      )}

      {/* Recursos */}
      {tab === 'recursos' && (
        <FlatList
          data={filteredResources}
          keyExtractor={r => r.id}
          renderItem={renderResource}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recursos y apoyo</Text>
                <Text style={styles.sectionSub}>Organizaciones y servicios para la comunidad</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                {(['todos', 'legal', 'salud', 'apoyo', 'emergencia'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, resFilter === f && styles.filterChipActive]}
                    onPress={() => setResFilter(f)}
                  >
                    <Text style={[styles.filterChipText, resFilter === f && styles.filterChipTextActive]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          }
        />
      )}

    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56, paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  title:    { fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },

  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1,
  },
  tabBtnActive: { borderBottomColor: colors.purple },
  tabText:      { fontSize: 13, color: colors.muted, fontWeight: '600' },
  tabTextActive:{ color: colors.purple },

  listContent: { paddingBottom: 100 },

  // Compose
  composeBox: {
    margin: spacing.lg, backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  composeInput: {
    color: colors.text, fontSize: 14, minHeight: 72,
    textAlignVertical: 'top', lineHeight: 20,
  },
  composeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  charCount:     { fontSize: 11, color: colors.muted },
  publishBtn: {
    backgroundColor: colors.purple, borderRadius: radius.full,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  publishBtnDisabled: { opacity: 0.4 },
  publishText:        { color: colors.white, fontWeight: '700', fontSize: 13 },

  // Posts
  postCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  postHeader:     { flexDirection: 'row', gap: spacing.sm, marginBottom: 10 },
  postAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1, borderColor: colors.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  postAvatarText: { fontSize: 14, fontWeight: '700', color: colors.purple },
  postAuthorRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postAuthorName: { fontSize: 13, fontWeight: '700', color: colors.text },
  verifiedDot:    { fontSize: 10, color: colors.teal },
  postMeta:       { fontSize: 11, color: colors.muted, marginTop: 1 },
  postContent:    { fontSize: 14, color: colors.text, lineHeight: 20 },
  postActions:    { flexDirection: 'row', marginTop: 10, gap: spacing.md },
  likeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeIcon:       { fontSize: 16, color: colors.muted },
  likeIconActive: { color: colors.primary },
  likeCount:      { fontSize: 12, color: colors.muted },
  likeCountActive:{ color: colors.primary },

  emptyBox:   { alignItems: 'center', marginTop: 48 },
  emptyEmoji: { fontSize: 40 },
  emptyText:  { color: colors.muted, marginTop: spacing.md, fontSize: 14 },

  // Events
  sectionHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: colors.text },
  sectionSub:    { fontSize: 12, color: colors.muted, marginTop: 2 },

  eventCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
  },
  eventCardPast:  { opacity: 0.55 },
  eventEmoji:     { fontSize: 28, marginTop: 2 },
  eventHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventTitle:     { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  eventDate:      { fontSize: 12, color: colors.muted, marginTop: 3 },
  tagRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: {
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.card2,
  },
  tagPast:  { borderColor: colors.muted },
  tagText:  { fontSize: 10, color: colors.muted },

  // Resources
  resourceCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, flexDirection: 'row', gap: spacing.md,
  },
  resourceDot:       { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  resourceHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  resourceEmoji:     { fontSize: 18 },
  resourceTitle:     { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 },
  resourceDesc:      { fontSize: 12, color: colors.muted, lineHeight: 17 },
  resourceCountry:   { fontSize: 14, marginLeft: 4 },

  filterScroll: { marginBottom: spacing.md },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card2,
  },
  filterChipActive:    { borderColor: colors.purple, backgroundColor: 'rgba(168,85,247,0.12)' },
  filterChipText:      { fontSize: 12, color: colors.muted },
  filterChipTextActive:{ color: colors.purple, fontWeight: '600' },
})
