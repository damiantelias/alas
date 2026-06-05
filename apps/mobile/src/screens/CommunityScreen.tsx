import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native'
import { colors, spacing, radius } from '../utils/theme'
import { api } from '../services/api'

interface Community {
  id: string
  name: string
  slug: string
  type: string
  countryCode: string
  memberCount: number
  isJoined: boolean
}

const COMMUNITY_EMOJIS: Record<string, string> = {
  'bsas-queer':     '🌆',
  'cdmx-queer':     '🌮',
  'sp-queer':       '🇧🇷',
  'trans-latam':    '🏳️‍⚧️',
  'lesbianas-latam':'💜',
  'gay-latam':      '🏳️‍🌈',
}

const COMMUNITY_COLORS: Record<string, string> = {
  city:     colors.primary,
  identity: colors.purple,
  interest: colors.teal,
}

export default function CommunityScreen() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<'all' | 'joined'>('all')

  useEffect(() => { loadCommunities() }, [])

  async function loadCommunities() {
    try {
      const { data } = await api.get('/communities')
      setCommunities(data.data ?? [])
    } catch {
      // Si el endpoint no existe aún, mostrar datos de ejemplo
      setCommunities([
        { id: '1', name: 'Buenos Aires Queer',  slug: 'bsas-queer',     type: 'city',     countryCode: 'AR', memberCount: 4200,  isJoined: true  },
        { id: '2', name: 'Trans LATAM',          slug: 'trans-latam',    type: 'identity', countryCode: 'AR', memberCount: 12300, isJoined: false },
        { id: '3', name: 'Lesbianas LATAM',      slug: 'lesbianas-latam',type: 'identity', countryCode: 'AR', memberCount: 8700,  isJoined: false },
        { id: '4', name: 'Gay LATAM',            slug: 'gay-latam',      type: 'identity', countryCode: 'AR', memberCount: 15400, isJoined: false },
        { id: '5', name: 'CDMX Queer',           slug: 'cdmx-queer',     type: 'city',     countryCode: 'MX', memberCount: 6100,  isJoined: false },
        { id: '6', name: 'São Paulo Queer',       slug: 'sp-queer',       type: 'city',     countryCode: 'BR', memberCount: 9800,  isJoined: false },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function toggleJoin(community: Community) {
    const wasJoined = community.isJoined
    // Optimistic update
    setCommunities(prev => prev.map(c =>
      c.id === community.id
        ? { ...c, isJoined: !c.isJoined, memberCount: c.memberCount + (wasJoined ? -1 : 1) }
        : c
    ))
    try {
      if (wasJoined) {
        await api.delete(`/communities/${community.id}/members`)
      } else {
        await api.post(`/communities/${community.id}/members`)
      }
    } catch {
      // Revertir si falló
      setCommunities(prev => prev.map(c =>
        c.id === community.id
          ? { ...c, isJoined: wasJoined, memberCount: c.memberCount + (wasJoined ? 1 : -1) }
          : c
      ))
    }
  }

  const filtered = communities.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.isJoined
    return matchSearch && matchFilter
  })

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.purple} />
    </View>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Comunidad 🏠</Text>

      {/* Búsqueda */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar grupos..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filtros */}
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'joined' && styles.filterActive]}
          onPress={() => setFilter('joined')}
        >
          <Text style={[styles.filterText, filter === 'joined' && styles.filterTextActive]}>
            Mis grupos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 32 }}>🔍</Text>
            <Text style={styles.emptyText}>No encontramos grupos</Text>
          </View>
        }
        renderItem={({ item }) => {
          const color  = COMMUNITY_COLORS[item.type] ?? colors.purple
          const emoji  = COMMUNITY_EMOJIS[item.slug] ?? '🏳️‍🌈'
          const members = item.memberCount >= 1000
            ? `${(item.memberCount / 1000).toFixed(1)}k miembros`
            : `${item.memberCount} miembros`

          return (
            <View style={styles.communityCard}>
              <View style={[styles.communityIcon, { backgroundColor: `${color}18` }]}>
                <Text style={styles.communityEmoji}>{emoji}</Text>
              </View>
              <View style={styles.communityInfo}>
                <Text style={styles.communityName}>{item.name}</Text>
                <Text style={styles.communityMembers}>{members}</Text>
              </View>
              <TouchableOpacity
                style={[styles.joinBtn, item.isJoined && styles.joinBtnActive]}
                onPress={() => toggleJoin(item)}
              >
                <Text style={[styles.joinBtnText, item.isJoined && styles.joinBtnTextActive]}>
                  {item.isJoined ? 'Unido ✓' : 'Unirse'}
                </Text>
              </TouchableOpacity>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  centered:     { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  screenTitle:  { fontSize: 22, fontWeight: '900', color: colors.text, paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
  searchIcon:   { fontSize: 14 },
  searchInput:  { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
  filters: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterActive:     { borderColor: colors.purple, backgroundColor: 'rgba(168,85,247,0.1)' },
  filterText:       { fontSize: 13, color: colors.muted },
  filterTextActive: { color: colors.purple, fontWeight: '600' },
  list:         { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  communityCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
  },
  communityIcon: {
    width: 42, height: 42, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  communityEmoji:   { fontSize: 20 },
  communityInfo:    { flex: 1 },
  communityName:    { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  communityMembers: { fontSize: 12, color: colors.muted },
  joinBtn: {
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card2,
  },
  joinBtnActive:    { backgroundColor: 'rgba(34,211,200,0.1)', borderColor: colors.teal },
  joinBtnText:      { fontSize: 12, color: colors.muted, fontWeight: '500' },
  joinBtnTextActive:{ color: colors.teal, fontWeight: '600' },
  empty:        { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyText:    { fontSize: 14, color: colors.muted },
})
