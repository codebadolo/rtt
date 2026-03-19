import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Pencil, Trash2, Tag, Settings2, ArrowLeft,
  Package, CheckCircle, XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import LoadingSpinner from '../../components/LoadingSpinner'
import { productsApi, variantsApi, optionsApi } from '../../api/products'

/* ── Tab ── */
function Tab({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
        active ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
      {count != null && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

/* ── Variante form ── */
function VarianteForm({ produitId, variante, onSubmit, onCancel, isLoading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      nom: variante?.nom ?? '',
      ajustement_prix: variante?.ajustement_prix ?? 0,
      est_actif: variante?.est_actif ?? true,
      produit: produitId,
    },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="label">Nom de la variante *</label>
        <input className={`input ${errors.nom ? 'border-red-400' : ''}`} placeholder="Ex: Quart, Demie, 3/4…" {...register('nom', { required: 'Requis' })} />
        {errors.nom && <p className="form-error">{errors.nom.message}</p>}
      </div>
      <div>
        <label className="label">Ajustement prix (FCFA)</label>
        <input type="number" step="1" className="input" placeholder="0" {...register('ajustement_prix', { valueAsNumber: true })} />
        <p className="text-xs text-gray-400 mt-1">Prix additionnel par rapport au prix de base du produit</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="var_actif" className="w-4 h-4 accent-orange-500" {...register('est_actif')} />
        <label htmlFor="var_actif" className="text-sm text-gray-700">Variante active</label>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? 'Sauvegarde…' : variante ? 'Modifier' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

/* ── Option form ── */
function OptionForm({ produitId, option, onSubmit, onCancel, isLoading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      nom: option?.nom ?? '',
      prix: option?.prix ?? 0,
      est_actif: option?.est_actif ?? true,
      produit: produitId,
    },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="label">Nom de l'option *</label>
        <input className={`input ${errors.nom ? 'border-red-400' : ''}`} placeholder="Ex: Piment, Mayonnaise…" {...register('nom', { required: 'Requis' })} />
        {errors.nom && <p className="form-error">{errors.nom.message}</p>}
      </div>
      <div>
        <label className="label">Prix additionnel (FCFA)</label>
        <input type="number" step="1" min="0" className="input" placeholder="0 = gratuit" {...register('prix', { valueAsNumber: true })} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="opt_actif" className="w-4 h-4 accent-orange-500" {...register('est_actif')} />
        <label htmlFor="opt_actif" className="text-sm text-gray-700">Option active</label>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? 'Sauvegarde…' : option ? 'Modifier' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

const CAT_COLORS = {
  SANDWICH: 'bg-orange-100 text-orange-700',
  BOISSON: 'bg-blue-100 text-blue-700',
  PATISSERIE: 'bg-pink-100 text-pink-700',
  SNACK: 'bg-yellow-100 text-yellow-700',
  AUTRE: 'bg-gray-100 text-gray-600',
}
const CAT_LABELS = { SANDWICH: 'Sandwich', BOISSON: 'Boisson', PATISSERIE: 'Pâtisserie', SNACK: 'Snack', AUTRE: 'Autre' }

export default function AdminProductDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState('variantes')
  const [showCreateVar, setShowCreateVar] = useState(false)
  const [editVar, setEditVar] = useState(null)
  const [showCreateOpt, setShowCreateOpt] = useState(false)
  const [editOpt, setEditOpt] = useState(null)

  const { data: product, isLoading: prodLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(id),
    enabled: !!id,
  })

  const { data: variantesData, isLoading: varLoading } = useQuery({
    queryKey: ['variantes', id],
    queryFn: () => variantsApi.list({ produit: id }),
    enabled: !!id,
  })
  const variantes = Array.isArray(variantesData) ? variantesData : variantesData?.results ?? []

  const { data: optionsData, isLoading: optLoading } = useQuery({
    queryKey: ['options', id],
    queryFn: () => optionsApi.list({ produit: id }),
    enabled: !!id,
  })
  const options = Array.isArray(optionsData) ? optionsData : optionsData?.results ?? []

  /* Variante mutations */
  const createVarMut = useMutation({
    mutationFn: (d) => variantsApi.create({ ...d, produit: Number(id) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['variantes', id] }); toast.success('Variante créée'); setShowCreateVar(false) },
    onError: (e) => toast.error(e.response?.data?.nom?.[0] ?? 'Erreur'),
  })
  const updateVarMut = useMutation({
    mutationFn: ({ id: vid, ...d }) => variantsApi.update(vid, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['variantes', id] }); toast.success('Variante modifiée'); setEditVar(null) },
    onError: () => toast.error('Erreur'),
  })
  const deleteVarMut = useMutation({
    mutationFn: (vid) => variantsApi.delete(vid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['variantes', id] }); toast.success('Variante supprimée') },
    onError: () => toast.error('Erreur'),
  })

  /* Option mutations */
  const createOptMut = useMutation({
    mutationFn: (d) => optionsApi.create({ ...d, produit: Number(id) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['options', id] }); toast.success('Option créée'); setShowCreateOpt(false) },
    onError: (e) => toast.error(e.response?.data?.nom?.[0] ?? 'Erreur'),
  })
  const updateOptMut = useMutation({
    mutationFn: ({ id: oid, ...d }) => optionsApi.update(oid, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['options', id] }); toast.success('Option modifiée'); setEditOpt(null) },
    onError: () => toast.error('Erreur'),
  })
  const deleteOptMut = useMutation({
    mutationFn: (oid) => optionsApi.delete(oid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['options', id] }); toast.success('Option supprimée') },
    onError: () => toast.error('Erreur'),
  })

  /* Columns */
  const varColumns = [
    {
      key: 'nom',
      label: 'Variante',
      sortable: true,
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Tag className="h-4 w-4 text-orange-400" />
          </div>
          <span className="font-semibold text-gray-800">{v}</span>
          {!row.est_actif && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactif</span>}
        </div>
      ),
    },
    {
      key: 'ajustement_prix',
      label: 'Ajustement',
      sortable: true,
      render: (v) => (
        <span className={`font-semibold text-sm ${v > 0 ? 'text-orange-600' : v < 0 ? 'text-red-500' : 'text-gray-400'}`}>
          {v > 0 ? `+${Number(v).toLocaleString('fr-FR')}` : v < 0 ? Number(v).toLocaleString('fr-FR') : '—'}
          {v !== 0 ? ' FCFA' : ''}
        </span>
      ),
    },
    {
      key: 'prix_total',
      label: 'Prix final',
      render: (v) => (
        <span className="font-bold text-gray-900">{v != null ? `${Number(v).toLocaleString('fr-FR')} FCFA` : '—'}</span>
      ),
    },
    {
      key: 'est_actif',
      label: 'Statut',
      render: (v) => (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${v !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {v !== false ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {v !== false ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      headerClass: 'w-20',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); setEditVar(row) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer "${row.nom}" ?`)) deleteVarMut.mutate(row.id) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const optColumns = [
    {
      key: 'nom',
      label: 'Option',
      sortable: true,
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Settings2 className="h-4 w-4 text-blue-400" />
          </div>
          <span className="font-semibold text-gray-800">{v}</span>
          {!row.est_actif && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
        </div>
      ),
    },
    {
      key: 'prix',
      label: 'Prix',
      sortable: true,
      render: (v) => (
        <span className={`font-semibold text-sm ${Number(v) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
          {Number(v) > 0 ? `+${Number(v).toLocaleString('fr-FR')} FCFA` : 'Gratuit'}
        </span>
      ),
    },
    {
      key: 'est_actif',
      label: 'Statut',
      render: (v) => (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${v !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {v !== false ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {v !== false ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      headerClass: 'w-20',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); setEditOpt(row) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer "${row.nom}" ?`)) deleteOptMut.mutate(row.id) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  if (prodLoading) {
    return (
      <DashboardLayout>
        <LoadingSpinner className="py-32" size="lg" />
      </DashboardLayout>
    )
  }

  if (!product) {
    return (
      <DashboardLayout>
        <div className="text-center py-32">
          <Package className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Produit introuvable</p>
          <Link to="/admin/produits" className="mt-4 inline-flex items-center gap-2 text-orange-500 hover:underline text-sm">
            <ArrowLeft className="h-4 w-4" /> Retour aux produits
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Produits', to: '/admin/produits' }, { label: product.nom }]} />

        {/* Product header card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">🍽️</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{product.nom}</h1>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${CAT_COLORS[product.categorie] ?? 'bg-gray-100 text-gray-500'}`}>
                  {CAT_LABELS[product.categorie] ?? product.categorie}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${product.est_actif !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {product.est_actif !== false ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <p className="text-gray-500 text-sm">{product.description || '—'}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400 mb-1">Prix de base</p>
              <p className="text-3xl font-extrabold text-orange-500">
                {Number(product.prix_base).toLocaleString('fr-FR')}
                <span className="text-sm font-medium text-gray-400 ml-1">FCFA</span>
              </p>
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-gray-900">{variantes.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Variante{variantes.length > 1 ? 's' : ''}</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <p className="text-2xl font-extrabold text-gray-900">{options.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Option{options.length > 1 ? 's' : ''}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-gray-900">
                {variantes.length > 0
                  ? `${Math.min(...variantes.map((v) => Number(v.prix_total ?? product.prix_base))).toLocaleString('fr-FR')} – ${Math.max(...variantes.map((v) => Number(v.prix_total ?? product.prix_base))).toLocaleString('fr-FR')}`
                  : Number(product.prix_base).toLocaleString('fr-FR')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Fourchette FCFA</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-gray-100/60 rounded-2xl p-1.5">
            <Tab active={tab === 'variantes'} onClick={() => setTab('variantes')} count={variantes.length}>
              <Tag className="h-4 w-4" />
              Variantes
            </Tab>
            <Tab active={tab === 'options'} onClick={() => setTab('options')} count={options.length}>
              <Settings2 className="h-4 w-4" />
              Options
            </Tab>
          </div>
          {tab === 'variantes' ? (
            <button onClick={() => setShowCreateVar(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouvelle variante
            </button>
          ) : (
            <button onClick={() => setShowCreateOpt(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouvelle option
            </button>
          )}
        </div>

        {/* DataTables */}
        {tab === 'variantes' ? (
          <DataTable
            columns={varColumns}
            data={variantes}
            isLoading={varLoading}
            emptyIcon={<Tag className="h-12 w-12" />}
            emptyText="Aucune variante pour ce produit"
            searchable={false}
            total={variantes.length}
          />
        ) : (
          <DataTable
            columns={optColumns}
            data={options}
            isLoading={optLoading}
            emptyIcon={<Settings2 className="h-12 w-12" />}
            emptyText="Aucune option pour ce produit"
            searchable={false}
            total={options.length}
          />
        )}
      </div>

      {/* Variante modals */}
      <Modal isOpen={showCreateVar} onClose={() => setShowCreateVar(false)} title="Nouvelle variante">
        <VarianteForm produitId={Number(id)} onSubmit={(d) => createVarMut.mutate(d)} onCancel={() => setShowCreateVar(false)} isLoading={createVarMut.isPending} />
      </Modal>
      <Modal isOpen={!!editVar} onClose={() => setEditVar(null)} title="Modifier la variante">
        <VarianteForm produitId={Number(id)} variante={editVar} onSubmit={(d) => updateVarMut.mutate({ id: editVar.id, ...d })} onCancel={() => setEditVar(null)} isLoading={updateVarMut.isPending} />
      </Modal>

      {/* Option modals */}
      <Modal isOpen={showCreateOpt} onClose={() => setShowCreateOpt(false)} title="Nouvelle option">
        <OptionForm produitId={Number(id)} onSubmit={(d) => createOptMut.mutate(d)} onCancel={() => setShowCreateOpt(false)} isLoading={createOptMut.isPending} />
      </Modal>
      <Modal isOpen={!!editOpt} onClose={() => setEditOpt(null)} title="Modifier l'option">
        <OptionForm produitId={Number(id)} option={editOpt} onSubmit={(d) => updateOptMut.mutate({ id: editOpt.id, ...d })} onCancel={() => setEditOpt(null)} isLoading={updateOptMut.isPending} />
      </Modal>
    </DashboardLayout>
  )
}
