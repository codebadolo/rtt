import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, CheckCircle, Clock, Loader2, MessageSquare, Package, Send, ShieldCheck, Store, User, XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { authApi, otpApi, parcoursApi, universitesApi } from '../../api/auth'
import { profilsApi } from '../../api/orders'
import { sectorsApi } from '../../api/sectors'
import CatalogueEditor from '../../components/CatalogueEditor'
import LoadingSpinner from '../../components/LoadingSpinner'
import ParcoursSteps from '../../components/ParcoursSteps'
import PublicLayout from '../../layouts/PublicLayout'
import useAuthStore from '../../stores/authStore'
import useParcoursStore from '../../stores/parcoursStore'

const NIVEAUX = ['Responsable', 'Code SMS', 'Boutique', 'Catalogue', 'Validation Ritôtô']
const [N_RESPONSABLE, N_OTP, N_BOUTIQUE, N_CATALOGUE, N_VALIDATION] = [0, 1, 2, 3, 4]
const ROLES_AUTORISES = ['ETUDIANT', 'VENDEUR_INTERIEUR', 'VENDEUR_EXTERIEUR']
const CATEGORIES = [
  ['SANDWICH', 'Sandwich'], ['BOISSON', 'Boisson'], ['PATISSERIE', 'Pâtisserie'], ['SNACK', 'Snack'], ['AUTRE', 'Autre'],
]

const local8 = (tel) => (tel ?? '').replace(/\D/g, '').slice(-8)
const erreur = (err, defaut) => {
  const d = err?.response?.data
  const v = d && (d.detail ?? d.error ?? d.code ?? Object.values(d)[0])
  return (Array.isArray(v) ? v[0] : v) || defaut
}

/**
 * Parcours vendeur progressif (dossier V1 §6-7) : responsable → OTP SMS →
 * boutique → catalogue → validation par l'équipe Ritôtô. La boutique n'est
 * visible des étudiants qu'une fois validée.
 */
export default function InscriptionVendeur() {
  const qc = useQueryClient()
  const { user, isAuthenticated, setUser, setSession } = useAuthStore()
  const [niveau, setNiveau] = useState(null)

  const { data: profil, isLoading: chargementProfil } = useQuery({
    queryKey: ['mon-profil-vendeur'],
    queryFn: () => profilsApi.getVendeur().catch((e) => { if (e.response?.status === 404) return null; throw e }),
    enabled: isAuthenticated && ROLES_AUTORISES.includes(user?.role),
  })

  const { data: profilUtilisateur } = useQuery({
    queryKey: ['profil-utilisateur', user?.id],
    queryFn: () => authApi.getProfile(),
    enabled: isAuthenticated && !user?.etat_parcours,
  })
  useEffect(() => { if (profilUtilisateur) setUser(profilUtilisateur) }, [profilUtilisateur, setUser])

  const telephoneVerifie = !!(isAuthenticated && user?.telephone_verifie)
  const valides = [
    telephoneVerifie, telephoneVerifie, !!profil, (profil?.nb_produits ?? 0) > 0, profil?.statut_validation === 'VALIDE',
  ]

  const pret = !isAuthenticated || (user?.etat_parcours && !chargementProfil)
  useEffect(() => {
    if (niveau !== null || !pret) return
    if (!telephoneVerifie) setNiveau(N_RESPONSABLE)
    else if (!profil) setNiveau(N_BOUTIQUE)
    else if (!profil.nb_produits && ['BROUILLON', 'CORRECTION'].includes(profil.statut_validation)) setNiveau(N_CATALOGUE)
    else setNiveau(N_VALIDATION)
  }, [pret, telephoneVerifie, profil, niveau])

  const rafraichir = async () => {
    await qc.invalidateQueries({ queryKey: ['mon-profil-vendeur'] })
    setUser(await authApi.getProfile())
  }

  if (isAuthenticated && user?.role && !ROLES_AUTORISES.includes(user.role)) {
    return (
      <PublicLayout masquerPanier>
        <p className="text-center text-gray-600 py-16">Ce compte ne peut pas ouvrir de boutique.</p>
      </PublicLayout>
    )
  }
  if (niveau === null) {
    return <PublicLayout masquerPanier><LoadingSpinner className="py-24" size="lg" /></PublicLayout>
  }

  return (
    <PublicLayout masquerPanier>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Ouvrir ma boutique</h1>
        <p className="text-sm text-gray-500 mb-5">L'équipe Ritôtô vous accompagne et valide votre boutique avant l'ouverture des ventes.</p>
        <ParcoursSteps
          niveaux={NIVEAUX.map((label, i) => ({ label, valide: valides[i] }))}
          courant={niveau}
          onSelect={(i) => setNiveau(i === N_OTP || (i === N_RESPONSABLE && telephoneVerifie) ? N_RESPONSABLE : i)}
        />
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          {niveau === N_RESPONSABLE && (
            <NiveauResponsable user={user} telephoneVerifie={telephoneVerifie}
              onDejaVerifie={() => setNiveau(profil ? N_CATALOGUE : N_BOUTIQUE)}
              onSuite={() => setNiveau(N_OTP)} />
          )}
          {niveau === N_OTP && (
            <NiveauOTP retour={() => setNiveau(N_RESPONSABLE)}
              onVerifie={async (token, u) => {
                setSession(token, u)
                toast.success('Numéro vérifié')
                const p = await profilsApi.getVendeur().catch(() => null)
                qc.setQueryData(['mon-profil-vendeur'], p)
                setNiveau(p ? (p.nb_produits ? N_VALIDATION : N_CATALOGUE) : N_BOUTIQUE)
              }} />
          )}
          {niveau === N_BOUTIQUE && (
            <NiveauBoutique profil={profil} retour={telephoneVerifie ? null : () => setNiveau(N_RESPONSABLE)}
              onSuite={async () => { await rafraichir(); setNiveau(N_CATALOGUE) }} />
          )}
          {niveau === N_CATALOGUE && (
            <div>
              <EnTete icon={Package} titre="Votre catalogue" retour={() => setNiveau(N_BOUTIQUE)}
                sousTitre="Produits, prix, disponibilité, photos et descriptions." />
              <CatalogueEditor />
              <button type="button" onClick={async () => { await rafraichir(); setNiveau(N_VALIDATION) }}
                className="btn-primary btn-lg w-full mt-6">
                Continuer <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {niveau === N_VALIDATION && profil && (
            <NiveauValidation profil={profil} retour={() => setNiveau(N_CATALOGUE)} onMaj={rafraichir} />
          )}
        </div>
      </div>
    </PublicLayout>
  )
}

function EnTete({ icon: Icon, titre, sousTitre, retour }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      {retour && (
        <button type="button" onClick={retour} aria-label="Étape précédente"
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      <div className="p-2 rounded-xl bg-orange-100 text-orange-600 flex-shrink-0"><Icon className="w-5 h-5" /></div>
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">{titre}</h2>
        {sousTitre && <p className="text-xs text-gray-500 mt-0.5">{sousTitre}</p>}
      </div>
    </div>
  )
}

/* ─────────── Niveau 1 : responsable ─────────── */
function NiveauResponsable({ user, telephoneVerifie, onSuite, onDejaVerifie }) {
  const { vendeur: brouillon, majVendeur } = useParcoursStore()
  const [prenom, setPrenom] = useState(brouillon.prenom || user?.prenom || '')
  const [nom, setNom] = useState(brouillon.nom || user?.nom || '')
  const [telephone, setTelephone] = useState(brouillon.telephone || local8(user?.telephone))
  const memeNumero = telephoneVerifie && local8(telephone) === local8(user?.telephone)

  const envoyer = useMutation({
    mutationFn: () => otpApi.envoyer(telephone),
    onSuccess: (res) => { majVendeur({ debug_code: res?.debug_code ?? null }); toast.success('Code envoyé par SMS'); onSuite() },
    onError: (err) => toast.error(erreur(err, "Impossible d'envoyer le code")),
  })
  const enregistrer = useMutation({
    mutationFn: () => authApi.updateProfile({ prenom, nom }),
    onSuccess: onDejaVerifie,
    onError: (err) => toast.error(erreur(err, 'Erreur')),
  })

  const soumettre = (e) => {
    e.preventDefault()
    majVendeur({ prenom: prenom.trim(), nom: nom.trim(), telephone })
    if (memeNumero) enregistrer.mutate()
    else envoyer.mutate()
  }

  return (
    <form onSubmit={soumettre}>
      <EnTete icon={User} titre="Le responsable de la boutique" sousTitre="Nous vérifierons ce numéro par SMS." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="v-prenom">Prénom</label><input id="v-prenom" className="input" value={prenom} onChange={(e) => setPrenom(e.target.value)} /></div>
          <div><label className="label" htmlFor="v-nom">Nom</label><input id="v-nom" className="input" value={nom} onChange={(e) => setNom(e.target.value)} /></div>
        </div>
        <div>
          <label className="label" htmlFor="v-tel">Téléphone</label>
          <div className="flex gap-2">
            <span className="input w-20 flex-shrink-0 text-center text-gray-500 bg-gray-50">+226</span>
            <input id="v-tel" type="tel" inputMode="numeric" className="input" placeholder="70 00 00 00" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </div>
          {memeNumero && <p className="flex items-center gap-1.5 text-sm text-green-700 mt-2"><ShieldCheck className="w-4 h-4" /> Numéro déjà vérifié</p>}
        </div>
      </div>
      <button type="submit" disabled={!prenom.trim() || !nom.trim() || local8(telephone).length !== 8 || envoyer.isPending || enregistrer.isPending}
        className="btn-primary btn-lg w-full mt-6 disabled:opacity-50">
        {envoyer.isPending || enregistrer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : memeNumero ? 'Continuer' : 'Recevoir le code par SMS'}
      </button>
      <p className="text-center text-sm text-gray-500 mt-4">
        Déjà inscrit ? Saisissez le même numéro pour reprendre votre inscription.
      </p>
    </form>
  )
}

/* ─────────── Niveau 2 : OTP SMS ─────────── */
function NiveauOTP({ retour, onVerifie }) {
  const { vendeur: brouillon, majVendeur } = useParcoursStore()
  const [code, setCode] = useState('')

  const verifier = useMutation({
    mutationFn: () => parcoursApi.verifierTelephone({
      telephone: brouillon.telephone, code, parcours: 'VENDEUR', nom: brouillon.nom, prenom: brouillon.prenom,
    }),
    onSuccess: (res) => { majVendeur({ debug_code: null }); onVerifie(res.token, res.user) },
    onError: (err) => { setCode(''); toast.error(erreur(err, 'Code invalide ou expiré')) },
  })
  const renvoyer = useMutation({
    mutationFn: () => otpApi.envoyer(brouillon.telephone),
    onSuccess: (res) => { majVendeur({ debug_code: res?.debug_code ?? null }); toast.success('Nouveau code envoyé') },
    onError: (err) => toast.error(erreur(err, "Impossible d'envoyer le code")),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); verifier.mutate() }}>
      <EnTete icon={MessageSquare} titre="Code reçu par SMS" retour={retour}
        sousTitre={`Saisissez le code envoyé au +226 ${local8(brouillon.telephone)}.`} />
      {brouillon.debug_code && (
        <p className="p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          Mode développement — aucun fournisseur SMS configuré. Code : <span className="font-mono font-bold">{brouillon.debug_code}</span>
        </p>
      )}
      <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus aria-label="Code de vérification"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none" />
      <button type="submit" disabled={code.length !== 6 || verifier.isPending} className="btn-primary btn-lg w-full mt-6 disabled:opacity-50">
        {verifier.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vérifier mon numéro'}
      </button>
      <button type="button" onClick={() => renvoyer.mutate()} disabled={renvoyer.isPending}
        className="w-full mt-3 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50">Renvoyer le code</button>
    </form>
  )
}

/* ─────────── Niveau 3 : informations boutique ─────────── */
function NiveauBoutique({ profil, retour, onSuite }) {
  const [f, setF] = useState({
    nom_boutique: profil?.nom_boutique ?? '',
    categorie_principale: profil?.categorie_principale ?? 'AUTRE',
    description: profil?.description ?? '',
    lieu: profil?.adresse_commerce && !profil?.emplacement ? 'EXTERIEUR' : 'CAMPUS',
    emplacement: profil?.emplacement ? String(profil.emplacement) : '',
    universite: profil?.universite ? String(profil.universite) : '',
    adresse_commerce: profil?.adresse_commerce ?? '',
    photo_boutique: null,
  })
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const { data: secteursData } = useQuery({ queryKey: ['secteurs-actifs'], queryFn: () => sectorsApi.actifs() })
  const secteurs = Array.isArray(secteursData) ? secteursData : secteursData?.results ?? []
  const { data: univData } = useQuery({ queryKey: ['universites-publiques'], queryFn: () => universitesApi.list() })
  const universites = Array.isArray(univData) ? univData : univData?.results ?? []

  const enregistrer = useMutation({
    mutationFn: () => {
      const form = new FormData()
      form.append('nom_boutique', f.nom_boutique.trim())
      form.append('categorie_principale', f.categorie_principale)
      form.append('description', f.description)
      if (f.lieu === 'CAMPUS') {
        form.append('emplacement', f.emplacement)
        form.append('adresse_commerce', '')
      } else {
        form.append('emplacement', '')
        form.append('universite', f.universite)
        form.append('adresse_commerce', f.adresse_commerce)
      }
      if (f.photo_boutique) form.append('photo_boutique', f.photo_boutique)
      return profil ? profilsApi.updateVendeur(form) : profilsApi.createVendeur(form)
    },
    onSuccess: () => { toast.success('Boutique enregistrée'); onSuite() },
    onError: (err) => toast.error(erreur(err, "Erreur lors de l'enregistrement")),
  })

  const complet = f.nom_boutique.trim() && (f.lieu === 'CAMPUS' ? f.emplacement : f.universite && f.adresse_commerce.trim())

  return (
    <form onSubmit={(e) => { e.preventDefault(); enregistrer.mutate() }}>
      <EnTete icon={Store} titre="Votre boutique" sousTitre="Nom, catégorie, description, emplacement et photo." retour={retour} />
      <div className="space-y-4">
        <div><label className="label" htmlFor="b-nom">Nom de la boutique</label>
          <input id="b-nom" className="input" placeholder="Ex : Chez Fatou" value={f.nom_boutique} onChange={maj('nom_boutique')} /></div>
        <div><label className="label" htmlFor="b-cat">Catégorie</label>
          <select id="b-cat" className="input" value={f.categorie_principale} onChange={maj('categorie_principale')}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div><label className="label" htmlFor="b-desc">Description</label>
          <textarea id="b-desc" rows={3} className="input resize-none" value={f.description} onChange={maj('description')} /></div>

        <div>
          <p className="label">Emplacement</p>
          <div className="grid grid-cols-2 gap-2">
            {[['CAMPUS', 'Sur le campus'], ['EXTERIEUR', 'Hors campus']].map(([v, l]) => (
              <label key={v} className={`p-3 rounded-xl border-2 cursor-pointer text-sm font-medium ${f.lieu === v ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
                <input type="radio" className="sr-only" checked={f.lieu === v} onChange={() => setF((x) => ({ ...x, lieu: v }))} />{l}
              </label>
            ))}
          </div>
        </div>
        {f.lieu === 'CAMPUS' ? (
          <div><label className="label" htmlFor="b-empl">Zone du campus</label>
            <select id="b-empl" className="input" value={f.emplacement} onChange={maj('emplacement')}>
              <option value="">Choisir</option>
              {secteurs.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select></div>
        ) : (
          <>
            <div><label className="label" htmlFor="b-univ">Université desservie</label>
              <select id="b-univ" className="input" value={f.universite} onChange={maj('universite')}>
                <option value="">Choisir</option>
                {universites.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
              </select></div>
            <div><label className="label" htmlFor="b-adr">Adresse du commerce</label>
              <input id="b-adr" className="input" value={f.adresse_commerce} onChange={maj('adresse_commerce')} /></div>
          </>
        )}

        <div>
          <label className="label" htmlFor="b-photo">Photo de la boutique</label>
          {profil?.photo_boutique && !f.photo_boutique && (
            <img src={profil.photo_boutique} alt="" className="w-full h-32 object-cover rounded-xl mb-2" />
          )}
          <input id="b-photo" type="file" accept="image/*" className="input text-xs"
            onChange={(e) => setF((x) => ({ ...x, photo_boutique: e.target.files?.[0] ?? null }))} />
        </div>
      </div>
      <button type="submit" disabled={!complet || enregistrer.isPending} className="btn-primary btn-lg w-full mt-6 disabled:opacity-50">
        {enregistrer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuer <ArrowRight className="w-4 h-4" /></>}
      </button>
    </form>
  )
}

/* ─────────── Niveau 5 : validation Ritôtô ─────────── */
function NiveauValidation({ profil, retour, onMaj }) {
  const soumettre = useMutation({
    mutationFn: () => profilsApi.soumettreVendeur(),
    onSuccess: () => { toast.success('Dossier transmis à Ritôtô'); onMaj() },
    onError: (err) => toast.error(erreur(err, 'Erreur')),
  })

  const statut = profil.statut_validation
  const points = [
    ['Téléphone vérifié', profil.telephone_verifie],
    ['Informations boutique', !!profil.nom_boutique && !!(profil.emplacement || profil.adresse_commerce)],
    ['Photo de la boutique', !!profil.photo_boutique],
    ['Au moins un produit', profil.nb_produits > 0],
  ]

  return (
    <div>
      <EnTete icon={ShieldCheck} titre="Validation par Ritôtô" retour={profil.peut_soumettre ? retour : null}
        sousTitre={`Statut : ${profil.statut_validation_display}`} />

      {statut === 'VALIDE' && (
        <Bandeau icon={CheckCircle} couleur="green" titre="Boutique validée et active">
          Votre boutique est visible des étudiants et peut recevoir des commandes.
        </Bandeau>
      )}
      {statut === 'EN_ATTENTE' && (
        <Bandeau icon={Clock} couleur="amber" titre="En attente de validation">
          L'équipe Ritôtô vérifie votre boutique et votre catalogue et peut vous contacter au +226 {local8(profil.utilisateur_telephone)}.
          Votre boutique n'est pas encore visible des étudiants.
        </Bandeau>
      )}
      {statut === 'CORRECTION' && (
        <Bandeau icon={XCircle} couleur="amber" titre="Corrections demandées">
          {profil.motif_rejet}
        </Bandeau>
      )}
      {statut === 'REFUSE' && (
        <Bandeau icon={XCircle} couleur="red" titre="Activation refusée">
          {profil.motif_rejet}
        </Bandeau>
      )}

      <ul className="space-y-2 my-5">
        {points.map(([label, ok]) => (
          <li key={label} className="flex items-center gap-2 text-sm">
            {ok ? <CheckCircle className="w-4 h-4 text-green-600" /> : <span className="w-4 h-4 rounded-full border-2 border-gray-300" />}
            <span className={ok ? 'text-gray-800' : 'text-gray-500'}>{label}{!ok && label.startsWith('Photo') ? ' (recommandé)' : ''}</span>
          </li>
        ))}
      </ul>

      {profil.peut_soumettre && (
        <button type="button" onClick={() => soumettre.mutate()} disabled={soumettre.isPending} className="btn-primary btn-lg w-full disabled:opacity-50">
          {soumettre.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Transmettre à Ritôtô</>}
        </button>
      )}
      {statut === 'VALIDE' && <Link to="/vendeur" className="btn-primary btn-lg w-full">Accéder à mon espace vendeur</Link>}
    </div>
  )
}

function Bandeau({ icon: Icon, couleur, titre, children }) {
  const c = {
    green: 'bg-green-50 border-green-200 text-green-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  }[couleur]
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${c}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-sm">{titre}</p>
        <p className="text-sm mt-0.5 opacity-90">{children}</p>
      </div>
    </div>
  )
}
