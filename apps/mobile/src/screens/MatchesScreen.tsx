import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { matchesApi } from '../services/api'

interface Match {
  matchId: string
  matchedAt: string
  otherUser: { userId: string; displayName: string; age: number; photo: string | null; isVerified: boolean; city: string }
  lastMessage: { content: string; isFromMe: boolean; createdAt: string } | null
  unreadCount: number
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMatches()
  }, [])

  async function loadMatches() {
    try {
      const { data } = await matchesApi.getAll()
      setMatches(data.data.matches)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Nuevos matches (sin mensajes)
  const newMatches  = matches.filter(m => !m.lastMessage)
  const activeChats = matches.filter(m =>  m.lastMessage)

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.purple} />
    </View>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Matches ✨</Text>

      {/* Nuevos matches en fila horizontal */}
      {newMatches.length > 0 && (
        <View style={styles.newMatchesSection}>
          <Text style={styles.sectionLabel}>Nuevos</Text>
          <FlatList
            horizontal showsHorizontalScrollIndicator={false}
            data={newMatches}
            keyExtractor={m => m.matchId}
            contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.newMatchItem}
                onPress={() => router.push({ pathname: '/chat', params: { matchData: JSON.stringify(item) } })}>
                <View style={styles.newMatchAvatar}>
                  {item.otherUser.photo
                    ? <Image source={{ uri: item.otherUser.photo }} style={styles.avatarImg} />
                    : <Text style={{ fontSize: 20 }}>👤</Text>
                  }
                  {item.otherUser.isVerified && (
                    <View style={styles.verifiedDot} />
                  )}
                </View>
                <Text style={styles.newMatchName} numberOfLines={1}>
                  {item.otherUser.displayName.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Lista de chats */}
      {activeChats.length === 0 && newMatches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>💜</Text>
          <Text style={styles.emptyTitle}>Todavía no tenés matches</Text>
          <Text style={styles.emptySub}>Seguí explorando perfiles en Descubrir</Text>
        </View>
      ) : (
        <FlatList
          data={activeChats}
          keyExtractor={m => m.matchId}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatRow}
              onPress={() => router.push({ pathname: '/chat', params: { matchData: JSON.stringify(item) } })}
            >
              <View style={styles.chatAvatar}>
                {item.otherUser.photo
                  ? <Image source={{ uri: item.otherUser.photo }} style={styles.avatarImgMd} />
                  : <View style={[styles.avatarImgMd, styles.avatarPlaceholder]}>
                      <Text style={{ fontSize: 18 }}>👤</Text>
                    </View>
                }
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{item.otherUser.displayName}</Text>
                <Text style={styles.chatMsg} numberOfLines={1}>
                  {item.lastMessage?.isFromMe ? 'Vos: ' : ''}
                  {item.lastMessage?.content}
                </Text>
              </View>
              <Text style={styles.chatTime}>
                {formatTime(item.lastMessage?.createdAt ?? item.matchedAt)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffH = (now.getTime() - d.getTime()) / 3_600_000
  if (diffH < 1)   return `${Math.floor(diffH * 60)}m`
  if (diffH < 24)  return `${Math.floor(diffH)}h`
  return `${Math.floor(diffH / 24)}d`
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  centered:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontSize: 22, fontWeight: '900', color: colors.text, paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md },
  sectionLabel:{ fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  newMatchesSection: { marginBottom: spacing.md },
  newMatchItem:  { alignItems: 'center', gap: 4, width: 62 },
  newMatchAvatar:{ position: 'relative' },
  avatarImg:     { width: 54, height: 54, borderRadius: radius.full, borderWidth: 2, borderColor: colors.purple },
  avatarImgMd:   { width: 46, height: 46, borderRadius: radius.full },
  avatarPlaceholder: { backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  verifiedDot:  { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal, borderWidth: 1.5, borderColor: colors.bg },
  newMatchName: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  chatRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  chatAvatar:{ position: 'relative' },
  unreadBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16,
    backgroundColor: colors.purple, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  unreadText: { fontSize: 9, color: colors.white, fontWeight: '700' },
  chatInfo:  { flex: 1 },
  chatName:  { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  chatMsg:   { fontSize: 12, color: colors.muted },
  chatTime:  { fontSize: 11, color: colors.muted },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle:{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  emptySub:  { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center' },
})
