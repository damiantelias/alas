import { router, useLocalSearchParams } from 'expo-router'
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, Alert, Animated,
} from 'react-native'
import { io, Socket } from 'socket.io-client'
import * as SecureStore from 'expo-secure-store'
import * as ImagePicker from 'expo-image-picker'
import { Audio } from 'expo-av'
import { colors, spacing, radius } from '../utils/theme'
import { matchesApi, profileApi } from '../services/api'
import { useAuthStore } from '../store/auth.store'
import ReportBlockModal from '../components/ReportBlockModal'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://alas-production-d959.up.railway.app'

interface Message {
  id: string
  senderId: string
  isFromMe: boolean
  content: string
  type: string
  createdAt: string
}

export default function ChatScreen() {
  const { matchData } = useLocalSearchParams<{ matchData: string }>()
  const match  = matchData ? JSON.parse(matchData as string) : null
  const userId = useAuthStore(s => s.user?.id)

  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [isTyping,     setIsTyping]     = useState(false)
  const [sendingImage, setSendingImage] = useState(false)
  const [showReport,   setShowReport]   = useState(false)
  const [recording,    setRecording]    = useState<Audio.Recording | null>(null)
  const [isRecording,  setIsRecording]  = useState(false)
  const [recordingSec, setRecordingSec] = useState(0)
  const [playingId,    setPlayingId]    = useState<string | null>(null)
  const [sound,        setSound]        = useState<Audio.Sound | null>(null)
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const pulseAnim      = useRef(new Animated.Value(1)).current
  const socketRef      = useRef<Socket | null>(null)
  const flatListRef    = useRef<FlatList>(null)
  const typingTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!match) return
    loadMessages()
    connectSocket()
    Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
    return () => {
      socketRef.current?.disconnect()
      sound?.unloadAsync()
      if (recordingTimer.current) clearInterval(recordingTimer.current)
    }
  }, [])

  // Pulso animado durante grabación
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
        ])
      ).start()
    } else {
      pulseAnim.stopAnimation()
      pulseAnim.setValue(1)
    }
  }, [isRecording])

  async function loadMessages() {
    try {
      const { data } = await matchesApi.getMessages(match.matchId)
      setMessages(data.data.messages)
    } catch (err) { console.error(err) }
  }

  async function connectSocket() {
    const token = await SecureStore.getItemAsync('accessToken')
    if (!token) return
    const socket = io(API_URL, { auth: { token }, transports: ['websocket'] })
    socketRef.current = socket
    socket.emit('chat:join', match.matchId)
    socket.on('chat:new_message', (msg: Message) => {
      setMessages(prev => [...prev, { ...msg, isFromMe: msg.senderId === userId }])
      flatListRef.current?.scrollToEnd({ animated: true })
    })
    socket.on('chat:typing_start', ({ userId: tid }: any) => {
      if (tid !== userId) { setIsTyping(true); setTimeout(() => setIsTyping(false), 2500) }
    })
  }

  function handleSend() {
    if (!input.trim()) return
    socketRef.current?.emit('chat:message', { matchId: match.matchId, content: input.trim(), type: 'text' })
    setInput('')
  }

  function handleTyping(text: string) {
    setInput(text)
    socketRef.current?.emit('chat:typing', match.matchId)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => setIsTyping(false), 2000)
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 })
    if (result.canceled) return
    setSendingImage(true)
    try {
      const res = await profileApi.uploadChatFile(result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg')
      socketRef.current?.emit('chat:message', { matchId: match.matchId, content: res.data.data.url, type: 'image' })
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'No se pudo enviar la imagen')
    } finally { setSendingImage(false) }
  }

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso al micrófono.'); return }
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      setRecording(rec)
      setIsRecording(true)
      setRecordingSec(0)
      recordingTimer.current = setInterval(() => setRecordingSec(s => s + 1), 1000)
    } catch (err) { console.error(err) }
  }

  async function stopRecording() {
    if (!recording) return
    if (recordingTimer.current) clearInterval(recordingTimer.current)
    setIsRecording(false)
    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecording(null)
      setRecordingSec(0)
      if (!uri || recordingSec < 1) return // ignorar grabaciones < 1 segundo
      // Subir el audio
      setSendingImage(true)
      const res = await profileApi.uploadChatFile(uri, 'audio/m4a')
      socketRef.current?.emit('chat:message', { matchId: match.matchId, content: res.data.data.url, type: 'audio' })
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo enviar el audio')
    } finally { setSendingImage(false) }
  }

  async function playAudio(url: string, msgId: string) {
    if (playingId === msgId) {
      await sound?.stopAsync()
      setPlayingId(null)
      return
    }
    await sound?.unloadAsync()
    try {
      const { sound: s } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true })
      setSound(s)
      setPlayingId(msgId)
      s.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) setPlayingId(null)
      })
    } catch { Alert.alert('Error', 'No se pudo reproducir el audio') }
  }

  function formatDuration(secs: number) {
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  }

  function formatMsgTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  function renderMessage({ item, index }: { item: Message; index: number }) {
    const showTime = index === 0 ||
      new Date(item.createdAt).getTime() - new Date(messages[index - 1]?.createdAt).getTime() > 600_000

    return (
      <View>
        {showTime && <Text style={styles.timeLabel}>{formatMsgTime(item.createdAt)}</Text>}
        <View style={[styles.msgRow, item.isFromMe && styles.msgRowMe]}>
          {item.type === 'image' ? (
            <Image source={{ uri: item.content }} style={[styles.chatImage, item.isFromMe && styles.chatImageMe]} resizeMode="cover" />
          ) : item.type === 'audio' ? (
            <TouchableOpacity style={[styles.audioBubble, item.isFromMe && styles.audioBubbleMe]} onPress={() => playAudio(item.content, item.id)}>
              <Text style={styles.audioIcon}>{playingId === item.id ? '⏸' : '▶'}</Text>
              <View style={styles.audioWave}>
                {[...Array(12)].map((_, i) => (
                  <View key={i} style={[styles.audioBar, { height: 4 + Math.sin(i * 0.8) * 8 }, item.isFromMe && styles.audioBarMe]} />
                ))}
              </View>
              <Text style={[styles.audioDuration, item.isFromMe && styles.audioDurationMe]}>🎤</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.bubble, item.isFromMe ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={[styles.bubbleText, item.isFromMe && styles.bubbleTextMe]}>{item.content}</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  if (!match) return (
    <View style={styles.centered}><Text style={{ color: colors.muted }}>Chat no disponible</Text></View>
  )

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <View style={styles.headerAvatar}>
          {match.otherUser.photo
            ? <Image source={{ uri: match.otherUser.photo }} style={styles.headerAvatarImg} />
            : <View style={[styles.headerAvatarImg, styles.avatarPlaceholder]}><Text style={{ fontSize: 18 }}>👤</Text></View>
          }
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{match.otherUser.displayName}</Text>
          <Text style={styles.headerStatus}>{isTyping ? '✍️ escribiendo...' : match.otherUser.city}</Text>
        </View>
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowReport(true)}>
          <Text style={styles.moreText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Mensajes */}
      <FlatList
        ref={flatListRef} data={messages} keyExtractor={m => m.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={renderMessage}
      />

      {/* Input */}
      {isRecording ? (
        <View style={styles.recordingBar}>
          <Animated.View style={[styles.recDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.recText}>Grabando... {formatDuration(recordingSec)}</Text>
          <TouchableOpacity style={styles.recStopBtn} onPress={stopRecording}>
            <Text style={styles.recStopText}>Enviar ↑</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.recCancelBtn} onPress={async () => {
            if (recordingTimer.current) clearInterval(recordingTimer.current)
            await recording?.stopAndUnloadAsync()
            setRecording(null); setIsRecording(false); setRecordingSec(0)
          }}>
            <Text style={styles.recCancelText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage} disabled={sendingImage}>
            {sendingImage ? <ActivityIndicator size="small" color={colors.purple} /> : <Text style={styles.attachIcon}>📎</Text>}
          </TouchableOpacity>
          <TextInput
            style={styles.input} placeholder="Escribí un mensaje..." placeholderTextColor={colors.muted}
            value={input} onChangeText={handleTyping} multiline maxLength={2000}
          />
          {input.trim()
            ? <TouchableOpacity style={styles.sendBtn} onPress={handleSend}><Text style={styles.sendIcon}>↑</Text></TouchableOpacity>
            : <TouchableOpacity style={styles.micBtn} onPressIn={startRecording} onPressOut={stopRecording}>
                <Text style={styles.micIcon}>🎤</Text>
              </TouchableOpacity>
          }
        </View>
      )}

      {match && (
        <ReportBlockModal
          visible={showReport} onClose={() => setShowReport(false)}
          targetUserId={match.otherUser.userId} targetName={match.otherUser.displayName}
          onBlocked={() => { setShowReport(false); router.replace('/(tabs)') }}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: 52, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 }, backText: { fontSize: 28, color: colors.muted, lineHeight: 30 },
  headerAvatar: {}, headerAvatarImg: { width: 36, height: 36, borderRadius: radius.full },
  avatarPlaceholder: { backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  headerStatus: { fontSize: 11, color: colors.teal },
  moreBtn: { padding: 4 }, moreText: { fontSize: 20, color: colors.muted, letterSpacing: 2 },
  messagesList: { padding: spacing.md, gap: 2 },
  timeLabel: { fontSize: 11, color: colors.muted, textAlign: 'center', marginVertical: spacing.md },
  msgRow: { flexDirection: 'row', marginVertical: 2 }, msgRowMe: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleThem: { backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: colors.text, lineHeight: 20 }, bubbleTextMe: { color: colors.white },
  chatImage: { width: 200, height: 240, borderRadius: radius.md, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  chatImageMe: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: 4 },
  // Audio
  audioBubble: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 10, maxWidth: '75%' },
  audioBubbleMe: { backgroundColor: 'rgba(255,77,109,0.2)', borderColor: colors.primary, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  audioIcon: { fontSize: 16, color: colors.text },
  audioWave: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  audioBar: { width: 3, borderRadius: 2, backgroundColor: colors.muted },
  audioBarMe: { backgroundColor: colors.primary },
  audioDuration: { fontSize: 12, color: colors.muted },
  audioDurationMe: { color: colors.primary },
  // Input
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  attachBtn: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  attachIcon: { fontSize: 18 },
  input: { flex: 1, backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.text, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 18, color: colors.white, fontWeight: '700' },
  micBtn: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: 18 },
  // Recording bar
  recordingBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(239,68,68,0.08)' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  recText: { flex: 1, color: colors.text, fontSize: 14 },
  recStopBtn: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  recStopText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  recCancelBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  recCancelText: { color: colors.muted, fontSize: 16 },
})
