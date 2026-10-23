import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { productsApi } from '../api/products'
import LoadingSpinner from './LoadingSpinner'

const CATEGORIES = [
  ['SANDWICH', 'Sandwich'], ['BOISSON', 'Boisson'], ['PATISSERIE', 'Pâtisserie'], ['SNACK', 'Snack'], ['AUTRE', 'Autre'],
]
const VIDE = { nom: '', prix_base: '', categorie: 'AUTRE', description: '', est_actif: true, stock_limite: false, quantite_stock: '', image: null }

const erreur = (err) => {
  const d = err?.response?.data
  const v = d && (d.detail ?? d.error ?? Object.values(d)[0])
  return (Array.isArray(v) ? v[0] : v) || 'Erreur'
}

/**
 * Catalogue du vendeur connecté : produits, prix, disponibilité, photos et
 * descriptions (niveau 4 du parcours vendeur). Le backend limite la liste et
 * les modifications aux produits de sa boutique.
 */
export default function CatalogueEditor() {
  const qc = useQueryClient()
  const [edition, setEdition] = useState(null) // null | produit | VIDE

  const { data, isLoading } = useQuery({
    queryKey: ['mon-catalogue'],
    queryFn: () => productsApi.list({ page_size: 200 }),
  })
  const produits = Array.isArray(data) ? data : data?.results ?? []
  const invalider = () => qc.invalidateQueries({ queryKey: ['mon-catalogue'] })

  const enregistrer = useMutation({
    mutationFn: (p) => {
      const form = new FormData()
      ;['nom', 'prix_base', 'categorie', 'description'].forEach((k) => form.append(k, p[k] ?? ''))
      form.append('est_actif', p.est_actif ? 'true' : 'false')
      form.append('stock_limite', p.stock_limite ? 'true' : 'false')
      if (p.stock_limite) form.append('quantite_stock', p.quantite_stock)
      if (p.image instanceof File) form.append('image', p.image)
      return p.id ? productsApi.update(p.id, form) : productsApi.create(form)
    },
    onSuccess: () => { invalider(); setEdition(null); toast.success('Produit enregistré') },
    onError: (err) => toast.error(erreur(err)),
  })

  const basculer = useMutation({
    mutationFn: (p) => productsApi.update(p.id, { est_actif: !p.est_actif }),
    onSuccess: invalider,
    onError: (err) => toast.error(erreur(err)),
  })

  const supprimer = useMutation({
    mutationFn: (p) => productsApi.delete(p.id),
    onSuccess: () => { invalider(); toast.success('Produit supprimé') },
    onError: (err) => toast.error(erreur(err)),
  })

  if (isLoading) return <LoadingSpinner className="py-10" />

  return (
    <div className="space-y-3">
      {produits.length === 0 && !edition && (
        <p className="text-sm text-gray-500 text-center py-6">Aucun produit pour l'instant. Ajoutez votre premier produit.</p>
      )}

      {produits.map((p) => (
        edition?.id === p.id ? (
          <FormulaireProduit key={p.id} initial={edition} onAnnuler={() => setEdition(null)}
            onValider={(v) => enregistrer.mutate(v)} enCours={enregistrer.isPending} />
        ) : (
          <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${p.est_actif ? 'border-gray-100' : 'border-dashed border-gray-200 opacity-60'}`}>
            {(p.image_url ?? p.image) ? (
              <img src={p.image_url ?? p.image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">🍽️</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{p.nom}</p>
              <p className="text-xs text-gray-500">
                {parseFloat(p.prix_base).toLocaleString('fr-FR')} FCFA · {p.est_actif ? (p.en_stock === false ? 'Rupture de stock' : 'Disponible') : 'Indisponible'}
              </p>
            </div>
            <button type="button" onClick={() => basculer.mutate(p)} title={p.est_actif ? 'Rendre indisponible' : 'Rendre disponible'}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              {p.est_actif ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => productsApi.get(p.id).then((d) => setEdition({ ...d, image: null }))} title="Modifier"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <Pencil className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => window.confirm(`Supprimer « ${p.nom} » ?`) && supprimer.mutate(p)} title="Supprimer"
              className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )
      ))}

      {edition && !edition.id ? (
        <FormulaireProduit initial={edition} onAnnuler={() => setEdition(null)}
          onValider={(v) => enregistrer.mutate(v)} enCours={enregistrer.isPending} />
      ) : !edition && (
        <button type="button" onClick={() => setEdition({ ...VIDE })}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-600 hover:border-orange-300 hover:text-orange-600">
          <Plus className="w-4 h-4" /> Ajouter un produit
        </button>
      )}
    </div>
  )
}

function FormulaireProduit({ initial, onValider, onAnnuler, enCours }) {
  const [p, setP] = useState(initial)
  const maj = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const valide = p.nom.trim() && Number(p.prix_base) > 0 && (!p.stock_limite || Number(p.quantite_stock) > 0)

  return (
    <div className="p-4 rounded-xl border-2 border-orange-200 bg-orange-50/40 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nom du produit</label>
          <input className="input" value={p.nom} onChange={maj('nom')} autoFocus />
        </div>
        <div>
          <label className="label">Prix (FCFA)</label>
          <input className="input" type="number" min="0" step="25" value={p.prix_base} onChange={maj('prix_base')} />
        </div>
      </div>
      <div>
        <label className="label">Catégorie</label>
        <select className="input" value={p.categorie} onChange={maj('categorie')}>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea rows={2} className="input resize-none" value={p.description} onChange={maj('description')} />
      </div>
      <div>
        <label className="label">Photo</label>
        <input type="file" accept="image/*" className="input text-xs"
          onChange={(e) => setP((x) => ({ ...x, image: e.target.files?.[0] ?? null }))} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700">
        <label className="flex items-center gap-2"><input type="checkbox" checked={p.est_actif} onChange={maj('est_actif')} /> Disponible</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={p.stock_limite} onChange={maj('stock_limite')} /> Stock limité</label>
        {p.stock_limite && (
          <input type="number" min="1" className="input w-28 py-1" placeholder="Quantité" value={p.quantite_stock ?? ''} onChange={maj('quantite_stock')} />
        )}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onAnnuler} className="btn-secondary flex-1">Annuler</button>
        <button type="button" disabled={!valide || enCours} onClick={() => onValider(p)} className="btn-primary flex-1 disabled:opacity-50">
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
