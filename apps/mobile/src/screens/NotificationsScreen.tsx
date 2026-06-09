import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, radius } from '../utils/theme'
import { notificationsApi } from '../services/api'

interface ActivityItem {
  id: string
  type: 'new_match' | 'new_message'
  title: string
  body: string
  createdAt: string
  matchId: string
  photo: string | null
}

const ICONS: Record<string, string> = {
  new_match:   '💜',
  new_message: '💬',
}

export default function NotificationsScreen() {
  const [items, setItems]       = useState<ActivityItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [readIds, setReadIds]   = useState<Set<string>>(new Set())

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const { data } = await notificationsApi.getActivity()
      setItems(data.data.activity)
    } catch {
      // silencioso — puede que no haya actividad aún
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function markRead(id: string) {
    setReadIds(prev => new Set([...prev, id]))
  }

  function markAllRead() {
    setReadIds(new Set(items.map(i => i.id)))
  }

  function handlePress(item: ActivityItem) {
    markRead(item.id)
    router.push('/(tabs)/matches')
  }

  function formatTime(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60)    return 'ahora'
    if (diff < 3600)  return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return `${Math.floor(diff / 86400)}d`
  }

  const unreadCount = items.filter(i => !readIds.has(i.id)).length

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.purple} />
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.screenTitle}>Notificaciones</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markRead}>Marcar todas</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.purple}
          />
        }
        renderItem={({ item }) => {
          const isRead = readIds.has(item.id)
          return (
            <TouchableOpacity
              style={[styles.card, !isRead && styles.cardUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                {item.photo
                  ? <Image source={{ uri: item.photo }} style={styles.avatar} />
                  : <View style={styles.iconCircle}>
                      <Text style={styles.iconEmoji}>{ICONS[item.type]}</Text>
                    </View>
                }
                {!isRead && <View style={styles.unreadDot} />}
              </View>

              <View style={styles.content}>
                <Text style={[styles.title, !isRead && styles.titleUnread]}>{item.title}</Text>
                <Text style={styles.body} numberOfLines={1}>{item.body}</Text>
              </View>

              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🔔</Text>
            <Text style={styles.emptyTitle}>Sin actividad todavía</Text>
            <Text style={styles.emptySub}>Cuando tengas matches o mensajes aparecerán acá</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  centered:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
  },
  screenTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  badge: {
    backgroundColor: colors.purple, borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: 'center',
  },
  badgeText:   { fontSize: 11, fontWeight: '700', color: colors.white },
  markRead:    { fontSize: 13, color: colors.purple },
  list:        { paddingHorizontal: spacing.lg, paddingBottom: 100, gap: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
  },
  cardUnread:  { borderColor: 'rgba(168,85,247,0.25)', backgroundColor: 'rgba(168,85,247,0.04)' },
  iconWrap:    { position: 'relative' },
  avatar:      { width: 44, height: 44, borderRadius: radius.full },
  iconCircle: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji:   { fontSize: 20 },
  unreadDot: {
    position: 'absolute', top: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.purple, borderWidth: 1.5, borderColor: colors.bg,
  },
  content:     { flex: 1 },
  title:       { fontSize: 13, fontWeight: '500', color: colors.muted, marginBottom: 2 },
  titleUnread: { fontWeight: '700', color: colors.text },
  body:        { fontSize: 12, color: colors.muted },
  time:        { fontSize: 11, color: colors.muted },
  empty:       { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySub:    { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
})
