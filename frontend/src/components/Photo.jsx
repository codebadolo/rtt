import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

/** URL d'aperçu d'un fichier choisi (avant envoi), libérée automatiquement. */
export function useApercu(fichier) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!(fichier instanceof File)) { setUrl(null); return undefined }
    const objet = URL.createObjectURL(fichier)
    setUrl(objet)
    return () => URL.revokeObjectURL(objet)
  }, [fichier])
  return url
}

/**
 * Photo affichée en entier (object-contain), sans recadrage ni déformation.
 * L'espace libre autour est rempli par une version floutée de la même image.
 * `zoomable` : un clic ouvre la photo en plein écran, à sa taille d'origine.
 */
export default function Photo({ src, alt = '', className = '', zoomable = true }) {
  const [ouvert, setOuvert] = useState(false)

  useEffect(() => {
    if (!ouvert) return
    const fermer = (e) => { if (e.key === 'Escape') setOuvert(false) }
    window.addEventListener('keydown', fermer)
    return () => window.removeEventListener('keydown', fermer)
  }, [ouvert])

  const image = (
    <>
      <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async"
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-50" />
      <img src={src} alt={alt} loading="lazy" decoding="async"
        className="relative w-full h-full object-contain" />
    </>
  )

  return (
    <>
      {zoomable ? (
        <button type="button" onClick={() => setOuvert(true)} title="Voir la photo en grand"
          className={`relative block overflow-hidden bg-gray-100 cursor-zoom-in ${className}`}>
          {image}
        </button>
      ) : (
        <div className={`relative overflow-hidden bg-gray-100 ${className}`}>{image}</div>
      )}

      {ouvert && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOuvert(false)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <X className="w-6 h-6" />
          </button>
          <img src={src} alt={alt} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}
