import React, { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Animated, FlatList, ViewToken,
} from 'react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { colors, spacing, radius } from '../utils/theme'

const { width: W, height: H } = Dimensions.get('window')

interface Slide {
  id: string
  emoji: string
  title: string
  subtitle: string
  bg: string
}

const SLIDES: Slide[] = [
  {
    id: '1',
    emoji: '🪶',
    title: 'Bienvenide a Alas',
    subtitle: 'El espacio de encuentro LGBTQ+ hecho para América Latina. Auténtico, seguro y tuyo.',
    bg: 'rgba(168,85,247,0.08)',
  },
  {
    id: '2',
    emoji: '🏳️‍🌈',
    title: 'Conectá con tu comunidad',
    subtitle: 'Descubrí personas cercanas que comparten tu identidad, tus valores y tus ganas de conectar.',
    bg: 'rgba(255,77,109,0.08)',
  },
  {
    id: '3',
    emoji: '💜',
    title: 'Matches que importan',
    subtitle: 'Swipeá, hacé match y empezá a chatear. Cada conexión es un paso hacia algo real.',
    bg: 'rgba(34,211,200,0.08)',
  },
  {
    id: '4',
    emoji: '🔒',
    title: 'Tu privacidad, primero',
    subtitle: 'Modo incógnito, control total sobre tus fotos y a quién te mostrás. Vos decidís.',
    bg: 'rgba(245,158,11,0.08)',
  },
]

const ACCENT = [colors.purple, colors.primary, colors.teal, colors.amber]

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const flatRef  = useRef<FlatList>(null)
  const scrollX  = useRef(new Animated.Value(0)).current

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index !== null && viewableItems[0]?.index !== undefined) {
      setCurrentIndex(viewableItems[0].index as number)
    }
  }).current

  async function finish() {
    await SecureStore.setItemAsync('onboarding_done', '1')
    router.replace('/register')
  }

  function next() {
    if (currentIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
    } else {
      finish()
    }
  }

  const isLast = currentIndex === SLIDES.length - 1

  return (
    <View style={styles.container}>

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={finish}>
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={s => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item, index }) => {
          const accentColor = ACCENT[index % ACCENT.length]
          return (
            <View style={[styles.slide, { width: W }]}>
              <View style={[styles.emojiContainer, { backgroundColor: item.bg, borderColor: accentColor + '40' }]}>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>
              <Text style={[styles.slideTitle, { color: accentColor }]}>{item.title}</Text>
              <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            </View>
          )
        }}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * W, i * W, (i + 1) * W]
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' })
          const opacity  = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' })
          const accentColor = ACCENT[i % ACCENT.length]
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, opacity, backgroundColor: accentColor }]}
            />
          )
        })}
      </View>

      {/* Botón */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: ACCENT[currentIndex % ACCENT.length] }]}
          onPress={next}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{isLast ? 'Crear mi cuenta' : 'Siguiente'}</Text>
        </TouchableOpacity>

        {isLast && (
          <TouchableOpacity style={styles.loginLink} onPress={() => { SecureStore.setItemAsync('onboarding_done', '1'); router.replace('/login') }}>
            <Text style={styles.loginLinkText}>Ya tengo cuenta →</Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  skipBtn: {
    position: 'absolute', top: 56, right: spacing.lg, zIndex: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  skipText: { color: colors.muted, fontSize: 14 },

  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingTop: 60,
  },
  emojiContainer: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: spacing.xl,
  },
  emoji:         { fontSize: 64 },
  slideTitle:    { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: spacing.md, letterSpacing: -0.5 },
  slideSubtitle: { fontSize: 16, color: colors.muted, textAlign: 'center', lineHeight: 26, maxWidth: 300 },

  dots: { flexDirection: 'row', gap: 6, marginBottom: spacing.xl },
  dot:  { height: 8, borderRadius: 4 },

  footer: { width: '100%', paddingHorizontal: spacing.xl, paddingBottom: 52, gap: spacing.md },
  btn: {
    borderRadius: radius.full, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText:       { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  loginLink:     { alignItems: 'center', paddingVertical: 4 },
  loginLinkText: { color: colors.muted, fontSize: 14 },
})
