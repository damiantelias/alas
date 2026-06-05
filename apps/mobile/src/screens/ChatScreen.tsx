import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import { io, Socket } from 'socket.io-client'
import * as SecureStore from 'expo-secure-store'
import { colors, spacing, radius } from '../utils/theme'
import { matchesApi } from '../services/api'
import { useAuthStore } from '../store/auth.store'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

interface Message {
  id: string
  senderId: string
  isFromMe: boolean
  content: string
  type: string
  createdAt: string
}

export default function ChatScreen({ route, navigation }: any) {
  const { match } = route.params
  const userId    = useAuthStore(s => s.user?.id)

  const [messages,    setMessages]    = useState<Message[]>([])
  const [input,       setInput]       = useState('')
  const [isTyping,    setIsTyping]    = useState(false)
  const socketRef     = useRef<Socket | null>(null)
  const flatListRef   = useRef<FlatList>(null)
  const typingTimeout = useRef<any>(null)

  useEffect(() => {
    loadMessages()
    connectSocket()
    return () => { socketRef.current?.disconnect() }
  }, [])

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

    socket.on('chat:typing_start', ({ userId: typingUserId }: any) => {
      if (typingUserId !== userId) setIsTyping(true)
    })
  }

  function handleSend() {
    if (!input.trim()) return
    socketRef.current?.emit('chat:message', {
      matchId: match.matchId,
      content: input.trim(),
      type: 'text',
    })
    setInput('')
  }

  function handleTyping(text: string) {
    setInput(text)
    socketRef.current?.emit('chat:typing', match.matchId)
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => setIsTyping(false), 2000)
  }

  function formatMsgTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          {match.otherUser.photo
            ? <Image source={{ uri: match.otherUser.photo }} style={styles.headerAvatarImg} />
            : <View style={[styles.headerAvatarImg, styles.avatarPlaceholder]}>
                <Text style={{ fontSize: 18 }}>👤</Text>
              </View>
          }
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{match.otherUser.displayName}</Text>
          <Text style={styles.headerStatus}>
            {isTyping ? '✍️ escribiendo...' : `${match.otherUser.city}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.moreBtn}>
          <Text style={styles.moreText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Mensajes */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const showTime = index === 0 ||
            (new Date(item.createdAt).getTime() - new Date(messages[index-1]?.createdAt).getTime()) > 600_000
          return (
            <View>
              {showTime && (
                <Text style={styles.timeLabel}>{formatMsgTime(item.createdAt)}</Text>
              )}
              <View style={[styles.msgRow, item.isFromMe && styles.msgRowMe]}>
                <View style={[styles.bubble, item.isFromMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, item.isFromMe && styles.bubbleTextMe]}>
                    {item.content}
                  </Text>
                </View>
              </View>
            </View>
          )
        }}
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escribí un mensaje..."
          placeholderTextColor={colors.muted}
          value={input}
          onChangeText={handleTyping}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: 52, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:        { padding: 4 },
  backText:       { fontSize: 28, color: colors.muted, lineHeight: 30 },
  headerAvatar:   {},
  headerAvatarImg:{ width: 36, height: 36, borderRadius: radius.full },
  avatarPlaceholder: { backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' },
  headerInfo:     { flex: 1 },
  headerName:     { fontSize: 15, fontWeight: '700', color: colors.text },
  headerStatus:   { fontSize: 11, color: colors.teal },
  moreBtn:        { padding: 4 },
  moreText:       { fontSize: 20, color: colors.muted, letterSpacing: 2 },
  messagesList:   { padding: spacing.md, gap: 2 },
  timeLabel:      { fontSize: 11, color: colors.muted, textAlign: 'center', marginVertical: spacing.md },
  msgRow:         { flexDirection: 'row', marginVertical: 2 },
  msgRowMe:       { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleThem:     { backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleMe:       { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText:     { fontSize: 14, color: colors.text, lineHeight: 20 },
  bubbleTextMe:   { color: colors.white },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.card2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 22, paddingHorizontal: spacing.md, paddingVertical: 10,
    color: colors.text, fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.card2 },
  sendIcon:        { fontSize: 18, color: colors.white, fontWeight: '700' },
})
