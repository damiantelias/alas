import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, radius } from '../utils/theme'
import { subscriptionsApi } from '../services/api'
import { useAuthStore } from '../store/auth.store'

const BENEFITS = [
  { emoji: 'heart',   label: 'Likes ilimitados',          sub: 'Sin límite de 10 por día',              free: false },
  { emoji: 'flash',   label: 'Ver quién te likeó',        sub: 'Antes de dar match',                    free: false },
  { emoji: 'star',    label: 'Super likes ilimitados',    sub: 'Solo 3 al día en versión free',          free: false },
  { emoji: 'rewind',  label: 'Rewind',                    sub: 'Deshacer el último swipe',               free: false },
  { emoji: 'hidden',  label: 'Modo incógnito',            sub: 'Navegá sin aparecer en el discover',     free: false },
  { emoji: 'filter',  label: 'Filtros avanzados',         sub: 'Edad, distancia y orientación',          free: false },
  { emoji: 'chat',    label: 'Chat después del match',    sub: 'Siempre disponible',                     free: true  },
  { emoji: 'feed',    label: 'Feed de comunidad',         sub: 'Siempre disponible',                     free: true  },
]

const EMOJI_MAP: Record<string, string> = {
  heart: '💜', flash: '⚡', star: '★', rewind: '↩', hidden: '👁', filter: '🔧', chat: '💬', feed: '🏠',
}

const PLANS = [
  { id: 'monthly', label: '1 mes',   price: 'AR$2.999', priceUSD: 'USD 2.99', badge: null },
  { id: 'yearly',  label: '12 meses', price: 'AR$19.999', priceUSD: 'USD 19.99', badge: '55% OFF' },
]

export default function UpgradeScreen() {
  const [selected, setSelected] = useState('monthly')
  const [loading,  setLoading]  = useState(false)
  const { user, setProfile }    = useAuthStore()

  async function handleSubscribe() {
    setLoading(true)
    try {
      await subscriptionsApi.upgrade('plus')
      Alert.alert(
        'Bienvenida a Alas Plus',
        'Tu suscripcion esta activa. Ahora tenes acceso a todas las funciones premium.',
        [{ text: 'Comenzar', onPress: () => router.back() }]
      )
    } catch {
      Alert.alert('Error', 'No se pudo procesar el pago. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const plan = PLANS.find(p => p.id === selected)!

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>x</Text>
        </TouchableOpacity>
        <View style={styles.headerGlow} />
        <Text style={styles.badge}>ALAS PLUS</Text>
        <Text style={styles.title}>Vola sin limites</Text>
        <Text style={styles.sub}>
          Desbloquea todo lo que Alas tiene para ofrecer y conecta con quien realmente te importa.
        </Text>
      </View>

      {/* Beneficios */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Que incluye Plus</Text>
        {BENEFITS.map(b => (
          <View key={b.label} style={styles.benefitRow}>
            <View style={[styles.benefitIcon, b.free && styles.benefitIconFree]}>
              <Text style={styles.benefitEmoji}>{EMOJI_MAP[b.emoji]}</Text>
            </View>
            <View style={styles.benefitText}>
              <Text style={[styles.benefitLabel, b.free && styles.benefitLabelFree]}>{b.label}</Text>
              <Text style={styles.benefitSub}>{b.sub}</Text>
            </View>
            <Text style={[styles.benefitCheck, b.free && styles.benefitCheckFree]}>
              {b.free ? 'gratis' : 'plus'}
            </Text>
          </View>
        ))}
      </View>

      {/* Selector de plan */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Elegí tu plan</Text>
        <View style={styles.plansRow}>
          {PLANS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.planCard, selected === p.id && styles.planCardActive]}
              onPress={() => setSelected(p.id)}
            >
              {p.badge && (
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{p.badge}</Text>
                </View>
              )}
              <Text style={[styles.planLabel, selected === p.id && styles.planLabelActive]}>
                {p.label}
              </Text>
              <Text style={[styles.planPrice, selected === p.id && styles.planPriceActive]}>
                {p.price}
              </Text>
              <Text style={styles.planPriceUSD}>{p.priceUSD}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.ctaBtnText}>
                Suscribirse por {plan.price} / {selected === 'monthly' ? 'mes' : 'ano'}
              </Text>
          }
        </TouchableOpacity>

        <Text style={styles.ctaDisclaimer}>
          Cancela cuando quieras. Precio en pesos argentinos. Renovacion automatica.
        </Text>

        <TouchableOpacity style={styles.restoreBtn}>
          <Text style={styles.restoreBtnText}>Restaurar compra</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 60, paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center', position: 'relative', overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute', top: -60, left: '10%',
    width: 280, height: 280,
    backgroundColor: 'rgba(168,85,247,0.15)', borderRadius: 140,
  },
  closeBtn: {
    position: 'absolute', top: 56, right: spacing.lg,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: colors.muted, fontSize: 16, fontWeight: '700' },
  badge: {
    backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)', borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 4,
    fontSize: 11, fontWeight: '800', color: colors.purple,
    letterSpacing: 2, marginBottom: spacing.md,
  },
  title: { fontSize: 30, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 10 },
  sub:   { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

  section:      { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  sectionTitle: { fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },

  benefitRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  benefitIcon: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: 'rgba(168,85,247,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  benefitIconFree:  { backgroundColor: 'rgba(255,255,255,0.04)' },
  benefitEmoji:     { fontSize: 16 },
  benefitText:      { flex: 1 },
  benefitLabel:     { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 1 },
  benefitLabelFree: { color: colors.muted, fontWeight: '400' },
  benefitSub:       { fontSize: 12, color: colors.muted },
  benefitCheck: {
    fontSize: 10, fontWeight: '700', color: colors.purple,
    backgroundColor: 'rgba(168,85,247,0.12)', paddingHorizontal: 7,
    paddingVertical: 3, borderRadius: radius.full, textTransform: 'uppercase',
  },
  benefitCheckFree: { color: colors.muted, backgroundColor: colors.card2 },

  plansRow:   { flexDirection: 'row', gap: spacing.md },
  planCard: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1.5,
    borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', position: 'relative',
  },
  planCardActive: { borderColor: colors.purple, backgroundColor: 'rgba(168,85,247,0.06)' },
  planBadge: {
    position: 'absolute', top: -10,
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  planBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white },
  planLabel:        { fontSize: 12, color: colors.muted, marginBottom: 4, marginTop: 8 },
  planLabelActive:  { color: colors.purple },
  planPrice:        { fontSize: 18, fontWeight: '900', color: colors.text },
  planPriceActive:  { color: colors.purple },
  planPriceUSD:     { fontSize: 11, color: colors.muted, marginTop: 2 },

  ctaWrap: { paddingHorizontal: spacing.lg, paddingBottom: 60, alignItems: 'center', gap: spacing.md },
  ctaBtn: {
    width: '100%', backgroundColor: colors.purple,
    borderRadius: radius.md, paddingVertical: 16, alignItems: 'center',
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText:     { fontSize: 15, fontWeight: '700', color: colors.white },
  ctaDisclaimer:  { fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 16 },
  restoreBtn:     { padding: spacing.sm },
  restoreBtnText: { fontSize: 13, color: colors.muted },
})
