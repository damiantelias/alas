import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { colors, spacing, radius } from '../utils/theme'

interface Notif {
  id: string
  type: 'new_match' | 'new_message' | 'new_like' | 'system'
  title: string
  body: string
  createdAt: string
  read: boolean
}

// Datos de ejemplo hasta conectar el backend
const DEMO_NOTIFS: Notif[] = [
  { id: '1', type: 'new_match',   title: '¡Nuevo match! 💜', body: 'Vos y Valentina se gustaron mutuamente',  createdAt: new Date(Date.now() - 3600000).toISOString(),  read: false },
  { id: '2', type: 'new_message', title: 'Nuevo mensaje',     body: 'Valentina: "Hola! ¿Cómo estás?"',        createdAt: new Date(Date.now() - 7200000).toISOString(),  read: false },
  { id: '3', type: 'new_like',    title: 'Alguien te likeó', body: 'Un perfil cercano a vos te likeó',        createdAt: new Date(Date.now() - 86400000).toISOString(), read: true  },
  { id: '4', type: 'system',      title: 'Bienvenida a Alas 🪶', body: 'Completá tu perfil para que más personas te encuentren', createdAt: new Date(Date.now() - 172800000).toISOString(), read: true },
]

const NOTIF_ICONS: Record<string, string> = {
  new_match:   '💜',
  new_message: '💬',
  new_like:    '⚡',
  system:      '🪶',
}

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState(DEMO_NOTIFS)

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  function formatTime(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 3600)  return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return `${Math.floor(diff / 86400)}d`
  }

  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Notificaciones 🔔</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markRead}>Marcar leídas</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifs}
        keyExtractor={n => n.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notifCard, !item.read && styles.notifCardUnread]}
            onPress={() => setNotifs(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))}
            activeOpacity={0.7}
          >
            <View style={styles.notifIcon}>
              <Text style={styles.notifEmoji}>{NOTIF_ICONS[item.type]}</Text>
            </View>
            <View style={styles.notifContent}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifBody} numberOfLines={1}>{item.body}</Text>
            </View>
            <View style={styles.notifRight}>
              <Text style={styles.notifTime}>{formatTime(item.createdAt)}</Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🔔</Text>
            <Text style={styles.emptyText}>Sin notificaciones por ahora</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
  },
  screenTitle:     { fontSize: 22, fontWeight: '900', color: colors.text },
  markRead:        { fontSize: 13, color: colors.purple },
  list:            { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  notifCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
  },
  notifCardUnread: { borderColor: 'rgba(168,85,247,0.2)', backgroundColor: 'rgba(168,85,247,0.04)' },
  notifIcon: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center',
  },
  notifEmoji:      { fontSize: 18 },
  notifContent:    { flex: 1 },
  notifTitle:      { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  notifBody:       { fontSize: 12, color: colors.muted },
  notifRight:      { alignItems: 'flex-end', gap: 4 },
  notifTime:       { fontSize: 11, color: colors.muted },
  unreadDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.purple },
  empty:           { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyText:       { fontSize: 14, color: colors.muted },
})
