import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Camera, CheckCircle, XCircle, MapPin, Package,
  User, ShoppingBag, Loader2, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { ordersApi } from '../api/orders'

const SCANNER_ID = 'qr-scanner-viewport'

export default function QRScannerModal({ isOpen, onClose }) {
  const queryClient = useQueryClient()
  const scannerRef = useRef(null)
  const [phase, setPhase] = useState('scanning') // scanning | preview | success | error
  const [scannedData, setScannedData] = useState(null)
  const [scanError, setScanError] = useState(null)

  // Démarrer/arrêter le scanner selon l'état du modal
  useEffect(() => {
    if (!isOpen) return
    setPhase('scanning')
    setScannedData(null)
    setScanError(null)

    let scanner = null

    const delay = setTimeout(() => {
      scanner = new Html5Qrcode(SCANNER_ID)
      scannerRef.current = scanner

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (text) => {
            try {
              const data = JSON.parse(text)
              if (!data.t) throw new Error('Token manquant')
              scanner.stop().catch(() => {})
              setScannedData(data)
              setPhase('preview')
            } catch {
              // QR non reconnu — on continue à scanner
            }
          },
          () => { /* scan errors are expected noise */ },
        )
        .catch((err) => {
          setScanError(
            err?.message?.includes('permission')
              ? "Accès à la caméra refusé. Autorisez la caméra dans les réglages."
              : "Impossible d'accéder à la caméra.",
          )
          setPhase('error')
        })
    }, 100) // petit délai pour que le DOM soit prêt

    return () => {
      clearTimeout(delay)
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [isOpen])

  const validateMutation = useMutation({
    mutationFn: () => ordersApi.validateQr(scannedData.t),
    onSuccess: (data) => {
      setPhase('success')
      queryClient.invalidateQueries({ queryKey: ['livreur-orders'] })
      queryClient.invalidateQueries({ queryKey: ['livreur-today'] })
      toast.success('Livraison confirmée !')
      // Fermer après 3s
      setTimeout(onClose, 3000)
    },
    onError: (err) => {
      const msg = err.response?.data?.error ?? 'Erreur lors de la validation'
      toast.error(msg)
    },
  })

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    onClose()
  }

  const handleRescan = () => {
    setPhase('scanning')
    setScannedData(null)
    setScanError(null)
    // Le useEffect ne se relance pas car isOpen n'a pas changé — on redémarre manuellement
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setTimeout(() => {
      const scanner = new Html5Qrcode(SCANNER_ID)
      scannerRef.current = scanner
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (text) => {
            try {
              const data = JSON.parse(text)
              if (!data.t) throw new Error('Token manquant')
              scanner.stop().catch(() => {})
              setScannedData(data)
              setPhase('preview')
            } catch {}
          },
          () => {},
        )
        .catch(() => {
          setScanError("Impossible d'accéder à la caméra.")
          setPhase('error')
        })
    }, 150)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Scanner le QR code">
      <div className="space-y-4">

        {/* Phase : caméra active */}
        {phase === 'scanning' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 text-center">
              Pointez la caméra vers le QR code de l'étudiant
            </p>
            <div
              id={SCANNER_ID}
              className="w-full rounded-xl overflow-hidden bg-black"
              style={{ minHeight: 300 }}
            />
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <Camera className="h-3.5 w-3.5" />
              Scan en cours…
            </div>
          </div>
        )}

        {/* Phase : erreur caméra */}
        {phase === 'error' && (
          <div className="text-center py-6 space-y-3">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>
            <p className="text-sm text-red-600 font-medium">{scanError}</p>
            <button onClick={handleClose} className="text-sm text-gray-500 underline">
              Fermer
            </button>
          </div>
        )}

        {/* Phase : prévisualisation + confirmation */}
        {phase === 'preview' && scannedData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold text-sm">QR code détecté</span>
            </div>

            {/* Résumé de la commande depuis le payload offline */}
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
              <div className="flex items-center gap-3 p-3">
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Étudiant</p>
                  <p className="text-sm font-medium text-gray-800">{scannedData.e ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Livraison</p>
                  <p className="text-sm font-medium text-gray-800">
                    {scannedData.salle ?? '—'}{scannedData.secteur ? ` · ${scannedData.secteur}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3">
                <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Commande</p>
                  <p className="text-sm font-mono font-bold text-gray-700">{scannedData.n ?? '—'}</p>
                </div>
              </div>
            </div>

            {/* Articles */}
            {Array.isArray(scannedData.items) && scannedData.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                  <ShoppingBag className="h-3.5 w-3.5" /> Articles à remettre
                </p>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {scannedData.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-sm text-gray-800">{item.p}</span>
                      <span className="text-sm font-bold text-orange-500">×{item.q}</span>
                    </div>
                  ))}
                </div>
                {scannedData.total != null && (
                  <div className="flex justify-between font-bold text-sm text-gray-700 pt-2">
                    <span>Total</span>
                    <span className="text-orange-500">
                      {Number(scannedData.total).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleRescan}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <XCircle className="h-4 w-4" /> Rescanner
              </button>
              <button
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-60"
              >
                {validateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Validation…</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Confirmer la livraison</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Phase : succès */}
        {phase === 'success' && (
          <div className="text-center py-8 space-y-3">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <p className="font-bold text-green-700 text-lg">Livraison confirmée !</p>
            <p className="text-sm text-gray-500">La commande a été marquée comme distribuée.</p>
            <p className="text-xs text-gray-400">Fermeture automatique dans 3 secondes…</p>
          </div>
        )}

      </div>
    </Modal>
  )
}
