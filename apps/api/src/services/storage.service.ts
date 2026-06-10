import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'avatars'

export async function uploadPhoto(
  userId: string,
  buffer: Buffer,
  mimeType: string,
  prefix = 'photos'
): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const filename = `${prefix}/${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) throw new Error(`Error al subir foto: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return data.publicUrl
}

export async function deletePhoto(url: string): Promise<void> {
  const urlObj = new URL(url)
  const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${BUCKET}/`)
  if (pathParts.length < 2) return
  const filePath = pathParts[1]
  await supabase.storage.from(BUCKET).remove([filePath])
}
