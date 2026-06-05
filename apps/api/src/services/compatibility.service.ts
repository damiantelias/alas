/**
 * Sistema de compatibilidad de Alas
 *
 * Lógica: el usuario elige a quién quiere ver (showMe).
 * Si no configuró nada, el sistema sugiere por orientación.
 *
 * Matriz de sugerencias automáticas:
 * - gay / homosexual  → hombres gay / hombres queer
 * - lesbiana          → mujeres lesbianas / mujeres queer
 * - bisexual / bi     → todos los géneros
 * - pansexual         → todos los géneros
 * - queer / no-binarie → todos
 * - trans (cualquier) → según su orientación declarada
 */

export interface CompatibilityFilters {
  genderIdentityFilter?: string[]   // géneros que el viewer quiere ver
  orientationFilter?: string[]      // orientaciones que el viewer quiere ver
  showAll: boolean                  // si no hay filtros específicos
}

const LESBIAN_KEYWORDS   = ['lesbiana', 'lesbian', 'gay woman', 'mujer gay']
const GAY_KEYWORDS       = ['gay', 'homosexual', 'hombre gay', 'gay man']
const BI_KEYWORDS        = ['bisexual', 'bi']
const PAN_KEYWORDS       = ['pansexual', 'pan', 'omnisexual']
const QUEER_KEYWORDS     = ['queer', 'no-binarie', 'no binarie', 'nonbinary', 'fluido', 'fluid']

function normalize(s: string): string {
  return s.toLowerCase().trim()
}

function matchesAny(value: string, keywords: string[]): boolean {
  const v = normalize(value)
  return keywords.some(k => v.includes(k))
}

/**
 * Dado el perfil del viewer, devuelve los filtros de compatibilidad sugeridos.
 * Si el usuario ya configuró showMe manualmente, esos tienen prioridad.
 */
export function buildCompatibilityFilters(
  viewerOrientation: string,
  viewerGender: string,
  userShowMe?: string[]  // lo que el usuario configuró manualmente
): CompatibilityFilters {

  // Si el usuario eligió manualmente qué ver, respetarlo
  if (userShowMe && userShowMe.length > 0) {
    return {
      genderIdentityFilter: userShowMe,
      showAll: false,
    }
  }

  // Sugerencia automática por orientación
  const orientation = normalize(viewerOrientation)

  if (matchesAny(orientation, LESBIAN_KEYWORDS)) {
    // Lesbiana: ver mujeres (cis, trans, no-binarie que se identifique como mujer)
    return {
      genderIdentityFilter: ['mujer', 'woman', 'femenino', 'lesbiana', 'trans woman', 'mujer trans'],
      showAll: false,
    }
  }

  if (matchesAny(orientation, GAY_KEYWORDS)) {
    // Gay: ver hombres
    return {
      genderIdentityFilter: ['hombre', 'man', 'masculino', 'gay', 'trans man', 'hombre trans'],
      showAll: false,
    }
  }

  if (matchesAny(orientation, BI_KEYWORDS) || matchesAny(orientation, PAN_KEYWORDS)) {
    // Bi/Pan: ver todos
    return { showAll: true }
  }

  if (matchesAny(orientation, QUEER_KEYWORDS)) {
    // Queer/no-binarie: ver todos por defecto
    return { showAll: true }
  }

  // Por defecto: mostrar todos dentro de la comunidad LGBTQ+
  return { showAll: true }
}

/**
 * Construye el fragmento SQL del WHERE para el discover
 */
export function buildDiscoverWhereClause(
  filters: CompatibilityFilters,
  paramOffset: number
): { sql: string; params: unknown[] } {
  if (filters.showAll || !filters.genderIdentityFilter?.length) {
    return { sql: '', params: [] }
  }

  // Busca coincidencia parcial en gender_identity (ILIKE)
  const conditions = filters.genderIdentityFilter.map((_, i) =>
    `LOWER(p.gender_identity) LIKE $${paramOffset + i}`
  )
  const params = filters.genderIdentityFilter.map(g => `%${g.toLowerCase()}%`)

  return {
    sql: `AND (${conditions.join(' OR ')})`,
    params,
  }
}
