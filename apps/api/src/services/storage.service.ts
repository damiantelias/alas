import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'avatars'

function getExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png':     'png',
    'image/webp':    'webp',
    'image/jpeg':    'jpg',
    'image/jpg':     'jpg',
    'audio/m4a':     'm4a',
    'audio/x-m4a':   'm4a',
    'audio/mp4':     'm4a',
    'audio/mpeg':    'mp3',
    'audio/aac':     'aac',
  }
  return map[mimeType] ?? 'bin'
}

export async function uploadPhoto(
  userId: string,
  buffer: Buffer,
  mimeType: string,
  prefix = 'photos'
): Promise<string> {
  const ext      = getExt(mimeType)
  const filename = `${prefix}/${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: mimeType, upsert: false })

  if (error) throw new Error(`Error al subir archivo: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return data.publicUrl
}

export async function deletePhoto(url: string): Promise<void> {
  const urlObj   = new URL(url)
  const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${BUCKET}/`)
  if (pathParts.length < 2) return
  await supabase.storage.from(BUCKET).remove([pathParts[1]])
}
