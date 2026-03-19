import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Package, Sandwich, Coffee, Cookie, ImagePlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Breadcrumb from '../../components/Breadcrumb'
import DashboardLayout from '../../layouts/DashboardLayout'
import Modal from '../../components/Modal'
import DataTable from '../../components/DataTable'
import { productsApi } from '../../api/products'

const CATEGORIES = ['SANDWICH', 'BOISSON', 'PATISSERIE', 'SNACK', 'AUTRE']

const CAT_COLORS = {
  SANDWICH:   'bg-orange-100 text-orange-700',
  BOISSON:    'bg-blue-100 text-blue-700',
  PATISSERIE: 'bg-pink-100 text-pink-700',
  SNACK:      'bg-yellow-100 text-yellow-700',
  AUTRE:      'bg-gray-100 text-gray-600',
}

const CAT_LABELS = {
  SANDWICH:   'Sandwich',
  BOISSON:    'Boisson',
  PATISSERIE: 'Pâtisserie',
  SNACK:      'Snack',
  AUTRE:      'Autre',
}

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-2xl ${color} flex-shrink-0`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900">
          {value ?? <span className="text-gray-300">—</span>}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

/* ── Product form ── */
function ProductForm({ product, onSubmit, onCancel, isLoading }) {
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(product?.image_url ?? null)
  const fileInputRef = useRef(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      nom: product?.nom ?? '',
      description: product?.description ?? '',
      prix_base: product?.prix_base ?? '',
      categorie: product?.categorie ?? 'SANDWICH',
      est_actif: product?.est_actif ?? true,
    },
  })

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFormSubmit = (data) => {
    onSubmit({ ...data, imageFile })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label className="label">Nom du produit *</label>
        <input
          className={`input ${errors.nom ? 'border-red-400' : ''}`}
          placeholder="Ex: Pain Brochettes"
          {...register('nom', { required: 'Requis' })}
        />
        {errors.nom && <p className="form-error">{errors.nom.message}</p>}
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          rows={2}
          className="input resize-none"
          placeholder="Description du produit…"
          {...register('description')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Prix de base (FCFA) *</label>
          <input
            type="number"
            step="1"
            min="0"
            className={`input ${errors.prix_base ? 'border-red-400' : ''}`}
            {...register('prix_base', { required: 'Requis', min: 0 })}
          />
          {errors.prix_base && <p className="form-error">{errors.prix_base.message}</p>}
        </div>

        <div>
          <label className="label">Catégorie *</label>
          <select className="input" {...register('categorie', { required: true })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CAT_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Image upload */}
      <div>
        <label className="label">Image du produit</label>
        {imagePreview ? (
          <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200">
            <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-red-50 text-gray-500 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors"
          >
            <ImagePlus className="h-8 w-8" />
            <span className="text-sm">Cliquez pour ajouter une image</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="est_actif"
          className="w-4 h-4 accent-primary-500"
          {...register('est_actif')}
        />
        <label htmlFor="est_actif" className="text-sm text-gray-700">
          Produit actif (visible à la commande)
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Annuler
        </button>
        <button type="submit" disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? 'Sauvegarde…' : product ? 'Modifier' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

/* ── Table columns ── */
const COLUMNS = [
  {
    key: 'nom',
    label: 'Produit',
    sortable: true,
    render: (val, row) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
          <span className="text-base">🍽️</span>
        </div>
        <div>
          <p className="font-medium text-gray-900 leading-tight">{val}</p>
          <p className="text-xs text-gray-400 truncate max-w-[200px]">{row.description || '—'}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'categorie',
    label: 'Catégorie',
    sortable: true,
    render: (val) => (
      <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${CAT_COLORS[val] ?? 'bg-gray-100 text-gray-500'}`}>
        {CAT_LABELS[val] ?? val}
      </span>
    ),
  },
  {
    key: 'prix_base',
    label: 'Prix de base',
    sortable: true,
    render: (val) => (
      <span className="font-semibold text-gray-800">
        {parseFloat(val).toLocaleString('fr-FR')} FCFA
      </span>
    ),
  },
  {
    key: 'variantes',
    label: 'Variantes',
    render: (val) => (
      <span className="text-gray-500 text-sm">{Array.isArray(val) ? val.length : val ?? 0}</span>
    ),
  },
  {
    key: 'options',
    label: 'Options',
    render: (val) => (
      <span className="text-gray-500 text-sm">{Array.isArray(val) ? val.length : val ?? 0}</span>
    ),
  },
  {
    key: 'est_actif',
    label: 'Statut',
    render: (val) => (
      <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${
        val !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}>
        {val !== false ? 'Actif' : 'Inactif'}
      </span>
    ),
  },
]

export default function AdminProducts() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', page, search, catFilter],
    queryFn: () =>
      productsApi.list({ page, search: search || undefined, categorie: catFilter || undefined }),
  })

  const { data: byCat } = useQuery({
    queryKey: ['products-by-category'],
    queryFn: () => productsApi.byCategory(),
  })

  const products = Array.isArray(data) ? data : data?.results ?? []
  const count = data?.count ?? products.length
  const totalPages = Math.ceil(count / 20)

  const stats = useMemo(() => {
    if (!byCat) return {}
    const totals = {}
    let activeTotal = 0
    CATEGORIES.forEach((c) => {
      const items = byCat[c] ?? []
      totals[c] = items.length
      activeTotal += items.length
    })
    return { totals, activeTotal }
  }, [byCat])

  const buildPayload = ({ imageFile, ...data }) => {
    if (!imageFile) return data
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== null && v !== undefined) fd.append(k, v)
    })
    fd.append('image', imageFile)
    return fd
  }

  const createMutation = useMutation({
    mutationFn: (d) => productsApi.create(buildPayload(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['products-by-category'] })
      toast.success('Produit créé')
      setShowCreate(false)
    },
    onError: () => toast.error('Erreur lors de la création'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }) => productsApi.update(id, buildPayload(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['products-by-category'] })
      toast.success('Produit modifié')
      setEditProduct(null)
    },
    onError: () => toast.error('Erreur lors de la modification'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['products-by-category'] })
      toast.success('Produit supprimé')
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  const handleDelete = (p) => {
    if (confirm(`Supprimer "${p.nom}" ?`)) deleteMutation.mutate(p.id)
  }

  const columns = [
    ...COLUMNS,
    {
      key: 'id',
      label: 'Actions',
      headerClass: 'text-right',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setEditProduct(row) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const categoryFilter = (
    <select
      value={catFilter}
      onChange={(e) => { setCatFilter(e.target.value); setPage(1) }}
      className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-orange-400 bg-white transition-colors"
    >
      <option value="">Toutes les catégories</option>
      {CATEGORIES.map((c) => (
        <option key={c} value={c}>{CAT_LABELS[c]}</option>
      ))}
    </select>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Produits' }]} />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
            <p className="text-gray-500 mt-1">Gérer le catalogue de produits</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nouveau produit
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={Package}
            label="Total produits"
            value={count}
            color="bg-orange-500"
          />
          <StatCard
            icon={Sandwich}
            label="Sandwichs"
            value={stats.totals?.SANDWICH ?? '—'}
            color="bg-amber-500"
          />
          <StatCard
            icon={Coffee}
            label="Boissons"
            value={stats.totals?.BOISSON ?? '—'}
            color="bg-blue-500"
          />
          <StatCard
            icon={Cookie}
            label="Pâtisseries"
            value={stats.totals?.PATISSERIE ?? '—'}
            color="bg-pink-500"
          />
        </div>

        {/* Data table */}
        <DataTable
          columns={columns}
          data={products}
          isLoading={isLoading}
          emptyIcon={<Package className="h-12 w-12" />}
          emptyText="Aucun produit trouvé"
          searchable
          searchPlaceholder="Rechercher un produit…"
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          filters={categoryFilter}
          total={count}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(row) => navigate(`/admin/produits/${row.id}`)}
        />
      </div>

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nouveau produit">
        <ProductForm
          onSubmit={(d) => createMutation.mutate(d)}
          onCancel={() => setShowCreate(false)}
          isLoading={createMutation.isPending}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={!!editProduct}
        onClose={() => setEditProduct(null)}
        title="Modifier le produit"
      >
        <ProductForm
          product={editProduct}
          onSubmit={(d) => updateMutation.mutate({ id: editProduct.id, ...d })}
          onCancel={() => setEditProduct(null)}
          isLoading={updateMutation.isPending}
        />
      </Modal>
    </DashboardLayout>
  )
}
