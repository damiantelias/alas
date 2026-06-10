import { router } from 'expo-router'
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, SectionList,
  TouchableOpacity, Image, ActivityIndicator,
  RefreshControl, TextInput,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { matchesApi } from '../services/api'

interface Match {
  matchId: string
  matchedAt: string
  otherUser: { userId: string; displayName: string; age: number; photo: string | null; isVerified: boolean; city: string }
  lastMessage: { content: string; type: string; isFromMe: boolean; createdAt: string } | null
  unreadCount: number
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d`
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function lastMsgPreview(m: Match): string {
  if (!m.lastMessage) return '¡Empezá la conversación! 💜'
  if (m.lastMessage.type === 'image') return m.lastMessage.isFromMe ? 'Enviaste una foto 📷' : 'Te envió una foto 📷'
  if (m.lastMessage.type === 'audio') return m.lastMessage.isFromMe ? 'Mensaje de voz 🎤' : 'Te envió un audio 🎤'
  const prefix = m.lastMessage.isFromMe ? 'Vos: ' : ''
  const text = m.lastMessage.content
  return prefix + (text.length > 40 ? text.slice(0, 40) + '…' : text)
}

function openChat(item: Match) {
  router.push({ pathname: '/chat', params: { matchData: JSON.stringify({ matchId: item.matchId, otherUser: item.otherUser }) } })
}

export default function MatchesScreen() {
  const [matches,    setMatches]    = useState<Match[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search,     setSearch]     = useState('')

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    try {
      const { data } = await matchesApi.getAll()
      setMatches(data.data.matches)
    } catch (err) { console.error(err) }
    finally { setLoading(false); setRefreshing(false) }
  }

  const filtered = matches.filter(m =>
    m.otherUser.displayName.toLowerCase().includes(search.toLowerCase())
  )

  const newMatches  = filtered.filter(m => !m.lastMessage)
  const activeChats = filtered.filter(m =>  m.lastMessage)
  const totalUnread = matches.reduce((s, m) => s + m.unreadCount, 0)

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator size="large" color={colors.purple} /></View>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mensajes</Text>
        {totalUnread > 0 && (
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      {/* Buscador */}
      {matches.length > 3 && (
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar conversación..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}

      <FlatList
        data={[]}  // usamos ListHeaderComponent para todo
        keyExtractor={() => ''}
        renderItem={null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMatches() }} tintColor={colors.purple} />}
        ListHeaderComponent={
          <>
            {/* Nuevos matches */}
            {newMatches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Nuevos matches ✨</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={newMatches}
                  keyExtractor={m => m.matchId}
                  contentContainerStyle={styles.newRow}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.newCard} onPress={() => openChat(item)}>
                      <View style={styles.newAvatarWrap}>
                        {item.otherUser.photo
                          ? <Image source={{ uri: item.otherUser.photo }} style={styles.newAvatar} />
                          : <View style={[styles.newAvatar, styles.avatarPlaceholder]}>
                              <Text style={{ fontSize: 22 }}>👤</Text>
                            </View>
                        }
                        <View style={styles.newDot} />
                      </View>
                      <Text style={styles.newName} numberOfLines={1}>{item.otherUser.displayName.split(' ')[0]}</Text>
                      <Text style={styles.newTime}>{timeAgo(item.matchedAt)}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Conversaciones activas */}
            {activeChats.length > 0 && (
              <View style={styles.section}>
                {newMatches.length > 0 && <Text style={styles.sectionLabel}>Conversaciones</Text>}
                {activeChats.map(item => (
                  <TouchableOpacity key={item.matchId} style={styles.chatRow} onPress={() => openChat(item)}>
                    <View style={styles.chatAvatarWrap}>
                      {item.otherUser.photo
                        ? <Image source={{ uri: item.otherUser.photo }} style={styles.chatAvatar} />
                        : <View style={[styles.chatAvatar, styles.avatarPlaceholder]}>
                            <Text style={{ fontSize: 20 }}>👤</Text>
                          </View>
                      }
                      {item.unreadCount > 0 && <View style={styles.unreadDot} />}
                    </View>
                    <View style={styles.chatInfo}>
                      <View style={styles.chatTopRow}>
                        <Text style={styles.chatName}>
                          {item.otherUser.displayName}
                          {item.otherUser.isVerified ? ' ✓' : ''}
                        </Text>
                        <Text style={styles.chatTime}>
                          {item.lastMessage ? timeAgo(item.lastMessage.createdAt) : ''}
                        </Text>
                      </View>
                      <View style={styles.chatBottomRow}>
                        <Text style={[styles.chatPreview, item.unreadCount > 0 && styles.chatPreviewUnread]} numberOfLines={1}>
                          {lastMsgPreview(item)}
                        </Text>
                        {item.unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{item.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Empty state */}
            {filtered.length === 0 && (
              <View style={styles.emptyBox}>
                {search
                  ? <><Text style={styles.emptyEmoji}>🔍</Text><Text style={styles.emptyText}>Sin resultados para "{search}"</Text></>
                  : <><Text style={styles.emptyEmoji}>💜</Text><Text style={styles.emptyText}>Todavía no tenés matches</Text><Text style={styles.emptySub}>Seguí explorando en Descubrí</Text></>
                }
              </View>
            )}
          </>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
  },
  title:          { fontSize: 24, fontWeight: '900', color: colors.text, flex: 1 },
  totalBadge:     { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  totalBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },

  section:      { marginBottom: spacing.md },
  sectionLabel: { fontSize: 12, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.lg, marginBottom: spacing.md },

  // Nuevos matches
  newRow:       { paddingHorizontal: spacing.lg, gap: spacing.md },
  newCard:      { alignItems: 'center', width: 72 },
  newAvatarWrap:{ position: 'relative', marginBottom: 6 },
  newAvatar:    { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.purple },
  newDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.teal, borderWidth: 2, borderColor: colors.bg,
  },
  newName:      { fontSize: 12, color: colors.text, fontWeight: '600', textAlign: 'center' },
  newTime:      { fontSize: 10, color: colors.muted },

  avatarPlaceholder: { backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },

  // Chats activos
  chatRow: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  chatAvatarWrap: { position: 'relative' },
  chatAvatar:     { width: 52, height: 52, borderRadius: 26 },
  unreadDot: {
    position: 'absolute', top: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.bg,
  },
  chatInfo:         { flex: 1, gap: 4 },
  chatTopRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName:         { fontSize: 15, fontWeight: '700', color: colors.text },
  chatTime:         { fontSize: 11, color: colors.muted },
  chatBottomRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatPreview:      { fontSize: 13, color: colors.muted, flex: 1 },
  chatPreviewUnread:{ color: colors.text, fontWeight: '600' },
  unreadBadge:      { backgroundColor: colors.primary, borderRadius: radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText:       { color: colors.white, fontSize: 11, fontWeight: '700' },

  emptyBox:  { alignItems: 'center', paddingTop: 80 },
  emptyEmoji:{ fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  emptySub:  { fontSize: 13, color: colors.muted, marginTop: 6 },
})
