import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'

type UploadRequest = AuthRequest & { file?: Express.Multer.File }

import { uploadPhoto, deletePhoto } from '../services/storage.service'
import { moderateImage } from '../services/moderation.service'
import { db } from '../models/db'
import { cache } from '../models/redis'

export async function uploadProfilePhoto(req: UploadRequest, res: Response) {
  const userId = req.userId!

  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No se recibió ninguna imagen' })
  }

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ ok: false, error: 'Solo se aceptan imágenes JPG, PNG o WebP' })
  }

  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: 'La imagen no puede superar 5 MB' })
  }

  try {
    // Moderar imagen con Sightengine
    const modResult = await moderateImage(req.file.buffer, req.file.mimetype)
    if (!modResult.approved) {
      return res.status(422).json({ ok: false, error: modResult.reason })
    }

    // Verificar cuántas fotos tiene actualmente
    const result = await db.query('SELECT photos FROM profiles WHERE user_id = $1', [userId])
    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Perfil no encontrado' })
    }

    const currentPhotos: { url: string; isPrivate: boolean; order: number }[] = result.rows[0].photos ?? []
    if (currentPhotos.length >= 6) {
      return res.status(400).json({ ok: false, error: 'Máximo 6 fotos permitidas. Eliminá una para subir otra.' })
    }

    // Subir a Supabase Storage
    const url = await uploadPhoto(userId, req.file.buffer, req.file.mimetype)

    // Agregar a la lista de fotos
    const newPhoto = { url, isPrivate: false, order: currentPhotos.length }
    const updatedPhotos = [...currentPhotos, newPhoto]

    await db.query('UPDATE profiles SET photos = $1 WHERE user_id = $2', [
      JSON.stringify(updatedPhotos),
      userId,
    ])

    await cache.del(`profile:${userId}`)

    return res.status(201).json({ ok: true, data: { url, photos: updatedPhotos } })
  } catch (err) {
    console.error('uploadProfilePhoto error:', err)
    return res.status(500).json({ ok: false, error: 'Error al subir la foto' })
  }
}

export async function deleteProfilePhoto(req: AuthRequest, res: Response) {
  const userId = req.userId!
  const { url } = req.body

  if (!url) {
    return res.status(400).json({ ok: false, error: 'URL requerida' })
  }

  try {
    const result = await db.query('SELECT photos FROM profiles WHERE user_id = $1', [userId])
    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Perfil no encontrado' })
    }

    const currentPhotos: { url: string; isPrivate: boolean; order: number }[] = result.rows[0].photos ?? []
    const updatedPhotos = currentPhotos
      .filter(p => p.url !== url)
      .map((p, i) => ({ ...p, order: i }))

    await db.query('UPDATE profiles SET photos = $1 WHERE user_id = $2', [
      JSON.stringify(updatedPhotos),
      userId,
    ])

    await cache.del(`profile:${userId}`)

    // Eliminar del storage
    await deletePhoto(url).catch(() => {}) // no fallar si ya fue borrada

    return res.json({ ok: true, data: { photos: updatedPhotos } })
  } catch (err) {
    console.error('deleteProfilePhoto error:', err)
    return res.status(500).json({ ok: false, error: 'Error al eliminar la foto' })
  }
}

export async function uploadChatAttachment(req: UploadRequest, res: Response) {
  const userId = req.userId!

  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo' })
  }

  const allowedImages = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const allowedAudio  = ['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a']
  const isImage = allowedImages.includes(req.file.mimetype)
  const isAudio = allowedAudio.includes(req.file.mimetype)

  if (!isImage && !isAudio) {
    return res.status(400).json({ ok: false, error: 'Tipo de archivo no soportado' })
  }

  const maxSize = isImage ? 5 * 1024 * 1024 : 10 * 1024 * 1024
  if (req.file.size > maxSize) {
    return res.status(400).json({ ok: false, error: `El archivo no puede superar ${isImage ? '5' : '10'} MB` })
  }

  try {
    if (isImage) {
      const modResult = await moderateImage(req.file.buffer, req.file.mimetype)
      if (!modResult.approved) {
        return res.status(422).json({ ok: false, error: modResult.reason })
      }
    }

    const url = await uploadPhoto(userId, req.file.buffer, req.file.mimetype, isAudio ? 'audio' : 'chat')
    return res.status(201).json({ ok: true, data: { url } })
  } catch (err) {
    console.error('uploadChatAttachment error:', err)
    return res.status(500).json({ ok: false, error: 'Error al subir el archivo' })
  }
}
