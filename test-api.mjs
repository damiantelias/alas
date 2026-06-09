// Script de test end-to-end para Alas API
// Ejecutar con: node test-api.mjs
// Requiere Node 18+ (fetch nativo)

const BASE = 'https://alas-production-d959.up.railway.app/api'

// Dos usuarios de prueba con ubicaciones cercanas (Buenos Aires)
const USER_A = { email: `test_a_${Date.now()}@alas.test`, password: 'Test1234!' }
const USER_B = { email: `test_b_${Date.now()}@alas.test`, password: 'Test1234!' }

let tokenA = '', tokenB = ''
let userAId = '', userBId = ''
let matchId = ''

const ok  = (label) => console.log(`  ✅  ${label}`)
const fail = (label, detail) => { console.error(`  ❌  ${label}`, detail ?? ''); process.exit(1) }
const h1  = (title) => console.log(`\n${'─'.repeat(50)}\n  ${title}\n${'─'.repeat(50)}`)

async function post(path, body, token) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  return { status: r.status, data: await r.json() }
}

async function get(path, token, params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const r = await fetch(BASE + path + qs, {
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  })
  return { status: r.status, data: await r.json() }
}

async function put(path, body, token) {
  const r = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  return { status: r.status, data: await r.json() }
}

async function del(path, body, token) {
  const r = await fetch(BASE + path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  return { status: r.status, data: await r.json() }
}

// ── TEST 1: Health ────────────────────────────────────────────────────────────
h1('TEST 1 · Health check')
{
  const r = await fetch('https://alas-production-d959.up.railway.app/health')
  const d = await r.json()
  if (!d.ok) fail('Health check', d)
  ok(`API activa · postgres=${d.services.postgres} redis=${d.services.redis} uptime=${Math.floor(d.uptime)}s`)
}

// ── TEST 2: Registro ──────────────────────────────────────────────────────────
h1('TEST 2 · Registro de usuarios')
{
  const rA = await post('/auth/register', USER_A)
  if (!rA.data.ok) fail('Registro usuario A', rA.data)
  tokenA = rA.data.data.tokens.accessToken
  userAId = rA.data.data.user.id
  ok(`Usuario A registrado: ${userAId}`)

  const rB = await post('/auth/register', USER_B)
  if (!rB.data.ok) fail('Registro usuario B', rB.data)
  tokenB = rB.data.data.tokens.accessToken
  userBId = rB.data.data.user.id
  ok(`Usuario B registrado: ${userBId}`)
}

// ── TEST 3: Crear perfiles ────────────────────────────────────────────────────
h1('TEST 3 · Crear perfiles con ubicación')
{
  // Buenos Aires centro: -34.6037, -58.3816
  const profileA = await put('/profiles/me', {
    displayName: 'TestA',
    birthdate: '1995-06-15',
    genderIdentity: 'No-binarie',
    sexualOrientation: 'Queer',
    lookingFor: ['relationship', 'friendship'],
    city: 'Buenos Aires',
    countryCode: 'AR',
    latitude: -34.6037,
    longitude: -58.3816,
  }, tokenA)
  if (!profileA.data.ok) fail('Perfil A', profileA.data)
  ok(`Perfil A creado: ${profileA.data.data.displayName}`)

  // A 500m de distancia
  const profileB = await put('/profiles/me', {
    displayName: 'TestB',
    birthdate: '1997-03-22',
    genderIdentity: 'Mujer trans',
    sexualOrientation: 'Bisexual',
    lookingFor: ['dates', 'relationship'],
    city: 'Buenos Aires',
    countryCode: 'AR',
    latitude: -34.6082,
    longitude: -58.3791,
  }, tokenB)
  if (!profileB.data.ok) fail('Perfil B', profileB.data)
  ok(`Perfil B creado: ${profileB.data.data.displayName}`)

  // El discover filtra perfiles sin fotos → agregar una foto placeholder a cada uno
  const photoA = await put('/profiles/me/photos', {
    photos: [{ url: 'https://picsum.photos/seed/testA/400/600', isPrivate: false, order: 0 }]
  }, tokenA)
  if (!photoA.data.ok) fail('Foto perfil A', photoA.data)
  ok('Foto agregada a perfil A')

  const photoB = await put('/profiles/me/photos', {
    photos: [{ url: 'https://picsum.photos/seed/testB/400/600', isPrivate: false, order: 0 }]
  }, tokenB)
  if (!photoB.data.ok) fail('Foto perfil B', photoB.data)
  ok('Foto agregada a perfil B')
}

// ── TEST 4: Discover feed ─────────────────────────────────────────────────────
h1('TEST 4 · Discover feed')
{
  const feed = await get('/discover', tokenA, { radiusKm: 25, page: 1 })
  if (!feed.data.ok) fail('Discover feed', feed.data)
  const profiles = feed.data.data.profiles
  const foundB = profiles.find(p => p.userId === userBId)
  if (!foundB) fail(`Usuario B no aparece en el feed (total: ${profiles.length} perfiles)`)
  ok(`Feed OK · ${profiles.length} perfil(es) · B aparece a ${foundB.distanceKm}km`)
}

// ── TEST 5: Like mutuo → match ────────────────────────────────────────────────
h1('TEST 5 · Like mutuo → match')
{
  // A le da like a B
  const likeA = await post('/likes', { toUserId: userBId, action: 'like' }, tokenA)
  if (!likeA.data.ok) fail('Like A→B', likeA.data)
  if (likeA.data.data.match) fail('No debería ser match todavía')
  ok('A le dio like a B · aún no hay match')

  // B le da like a A → debería crear match
  const likeB = await post('/likes', { toUserId: userAId, action: 'like' }, tokenB)
  if (!likeB.data.ok) fail('Like B→A', likeB.data)
  if (!likeB.data.data.match) fail('Debería ser match pero no lo es', likeB.data)
  matchId = likeB.data.data.matchId
  ok(`Match creado! matchId: ${matchId}`)
}

// ── TEST 6: Matches list ──────────────────────────────────────────────────────
h1('TEST 6 · Lista de matches')
{
  const matches = await get('/matches', tokenA)
  if (!matches.data.ok) fail('Matches list', matches.data)
  const found = matches.data.data.matches.find(m => m.matchId === matchId)
  if (!found) fail('Match no aparece en la lista', JSON.stringify(matches.data.data.matches.map(m => m.matchId)))
  ok(`Match visible · contraparte: ${found.otherUser.displayName}`)
}

// ── TEST 7: Activity feed ─────────────────────────────────────────────────────
h1('TEST 7 · Activity feed (notificaciones)')
{
  const activity = await get('/notifications/activity', tokenA)
  if (!activity.data.ok) fail('Activity feed', activity.data)
  const matchEvent = activity.data.data.activity.find(e => e.type === 'new_match')
  if (!matchEvent) fail('Match no aparece en el activity feed')
  ok(`Activity feed OK · evento: "${matchEvent.body}"`)
}

// ── RESUMEN ───────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`)
console.log('  TODOS LOS TESTS PASARON')
console.log(`${'='.repeat(50)}\n`)
console.log('Usuarios de prueba creados (podés limpiarlos desde Railway console):')
console.log(`  A: ${USER_A.email}  id=${userAId}`)
console.log(`  B: ${USER_B.email}  id=${userBId}`)
