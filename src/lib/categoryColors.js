/**
 * Shared service-category colour constants.
 * Single source of truth — import this everywhere colours are needed.
 */

/** Hex colours keyed by canonical category slug */
export const CATEGORY_COLORS = {
  PPF_WRAP:       '#7C3AED',
  MYTI_CISTENI:   '#2563EB',
  DETAILING:      '#16A34A',
  PODVOZKY:       '#92400E',
  TONOVANI_SKEL:  '#CA8A04',
  SERVIS:         '#EA580C',
  TRANSPORT:      '#6B7280',
  EXTERNI_SLUZBY: '#DC2626',
};

/** Czech display names for each slug (used in legend, tooltips) */
export const CATEGORY_LABELS = {
  PPF_WRAP:       'PPF & Wrap',
  MYTI_CISTENI:   'Mytí a čištění',
  DETAILING:      'Detailing',
  PODVOZKY:       'Podvozky',
  TONOVANI_SKEL:  'Tónování skel',
  SERVIS:         'Servis',
  TRANSPORT:      'Transport',
  EXTERNI_SLUZBY: 'Externí služby',
};

/**
 * Maps every Tailwind bg-* class the DB might store to its canonical hex.
 * All values reference CATEGORY_COLORS — no other hex sources.
 */
const TW_TO_HEX = {
  // violet → PPF_WRAP
  'violet-600': CATEGORY_COLORS.PPF_WRAP,
  'violet-700': CATEGORY_COLORS.PPF_WRAP,
  'purple-600': CATEGORY_COLORS.PPF_WRAP,
  // blue → MYTI_CISTENI
  'blue-600':   CATEGORY_COLORS.MYTI_CISTENI,
  'blue-700':   CATEGORY_COLORS.MYTI_CISTENI,
  'indigo-600': CATEGORY_COLORS.MYTI_CISTENI,
  // green → DETAILING
  'green-600':  CATEGORY_COLORS.DETAILING,
  'green-700':  CATEGORY_COLORS.DETAILING,
  'teal-600':   CATEGORY_COLORS.DETAILING,
  // amber/brown → PODVOZKY
  'amber-800':  CATEGORY_COLORS.PODVOZKY,
  'stone-700':  CATEGORY_COLORS.PODVOZKY,
  'yellow-800': CATEGORY_COLORS.PODVOZKY,
  // yellow → TONOVANI_SKEL
  'yellow-600': CATEGORY_COLORS.TONOVANI_SKEL,
  'yellow-500': CATEGORY_COLORS.TONOVANI_SKEL,
  'amber-600':  CATEGORY_COLORS.TONOVANI_SKEL,
  'amber-500':  CATEGORY_COLORS.TONOVANI_SKEL,
  // orange → SERVIS
  'orange-600': CATEGORY_COLORS.SERVIS,
  'orange-500': CATEGORY_COLORS.SERVIS,
  'orange-700': CATEGORY_COLORS.SERVIS,
  // gray/slate → TRANSPORT
  'gray-500':   CATEGORY_COLORS.TRANSPORT,
  'gray-400':   CATEGORY_COLORS.TRANSPORT,
  'gray-600':   CATEGORY_COLORS.TRANSPORT,
  'slate-500':  CATEGORY_COLORS.TRANSPORT,
  'slate-400':  CATEGORY_COLORS.TRANSPORT,
  // red → EXTERNI_SLUZBY
  'red-600':    CATEGORY_COLORS.EXTERNI_SLUZBY,
  'red-700':    CATEGORY_COLORS.EXTERNI_SLUZBY,
  'rose-600':   CATEGORY_COLORS.EXTERNI_SLUZBY,
};

/**
 * Resolve a Tailwind color_class string (e.g. "bg-violet-700 text-white")
 * to a hex colour using CATEGORY_COLORS as the authority.
 * Falls back to #94a3b8 when no match found.
 */
export function catColorFromClass(colorClass = '') {
  const m = String(colorClass).match(/bg-([a-z]+-\d{3})/);
  return m ? (TW_TO_HEX[m[1]] ?? '#94a3b8') : '#94a3b8';
}

/**
 * Resolve a category name (as stored in the DB) to a hex colour.
 * Bulletproof fallback when color_class or catColorMap lookup fails.
 */
export function catColorFromName(name = '') {
  const n = String(name).toLowerCase();
  if (n.includes('ppf') || n.includes('wrap') || n.includes('fóli') || n.includes('foli')) return CATEGORY_COLORS.PPF_WRAP;
  if (n.includes('myt') || n.includes('čišt') || n.includes('cist')) return CATEGORY_COLORS.MYTI_CISTENI;
  if (n.includes('detail')) return CATEGORY_COLORS.DETAILING;
  if (n.includes('podvoz')) return CATEGORY_COLORS.PODVOZKY;
  if (n.includes('tóno') || n.includes('tono') || n.includes('skel') || n.includes('čeln')) return CATEGORY_COLORS.TONOVANI_SKEL;
  if (n.includes('serv')) return CATEGORY_COLORS.SERVIS;
  if (n.includes('transport') || n.includes('přep') || n.includes('prep')) return CATEGORY_COLORS.TRANSPORT;
  if (n.includes('extern') || n.includes('služb') || n.includes('sluzb')) return CATEGORY_COLORS.EXTERNI_SLUZBY;
  return null;
}
