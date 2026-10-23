import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, CheckCircle, CreditCard, Loader2, MessageSquare, Phone, ShieldCheck, ShoppingCart, User,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import orangeLogo from '../../Orange-Money-logo.jpg'
import { authApi, otpApi, parcoursApi } from '../../api/auth'
import { configApi } from '../../api/admin'
import { creneauxApi, ordersApi } from '../../api/orders'
import { paymentsApi } from '../../api/payments'
import { roomsApi } from '../../api/sectors'
import LoadingSpinner from '../../components/LoadingSpinner'
import ParcoursSteps from '../../components/ParcoursSteps'
import PublicLayout from '../../layouts/PublicLayout'
import useAuthStore from '../../stores/authStore'
import useCartStore from '../../stores/cartStore'
import useParcoursStore from '../../stores/parcoursStore'

const NIVEAUX = ['Nom et prénom', 'Date de naissance', 'Téléphone', 'Code SMS', 'Récapitulatif', 'Paiement']
const [N_IDENTITE, N_NAISSANCE, N_TELEPHONE, N_OTP, N_RECAP, N_PAIEMENT] = [0, 1, 2, 3, 4, 5]

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

const messageErreur = (err, defaut) => {
  const d = err?.response?.data
  if (!d) return defaut
  if (typeof d === 'string') return defaut
  const premier = (v) => (Array.isArray(v) ? v[0] : v)
  return premier(d.detail) ?? premier(d.error) ?? premier(d.code) ?? premier(d.telephone)
    ?? premier(d.jour_naissance) ?? premier(d.mois_naissance) ?? premier(Object.values(d)[0]) ?? defaut
}

const local8 = (tel) => (tel ?? '').replace(/\D/g, '').slice(-8)

/**
 * Parcours de commande progressif (dossier V1 §2-5).
 *
 * Les informations personnelles ne sont demandées qu'au moment de commander,
 * une par niveau. La vérification du code SMS confirme uniquement le numéro :
 * la commande est ensuite vérifiée (récapitulatif) puis confirmée par le
 * paiement, et seulement par lui.
 */
export default function Checkout() {
  const navigate = useNavigate()
  const { user, isAuthenticated, setUser, setSession } = useAuthStore()
  const { items, clearCart } = useCartStore()
  const { etudiant: brouillon, majEtudiant, universite } = useParcoursStore()

  const [niveau, setNiveau] = useState(null)
  const [profilCharge, setProfilCharge] = useState(!isAuthenticated)
  const [commande, setCommande] = useState(null)

  // Profil complet (état du parcours) pour un utilisateur déjà connecté
  useEffect(() => {
    if (!isAuthenticated) { setProfilCharge(true); return }
    if (user?.etat_parcours) { setProfilCharge(true); return }
    authApi.getProfile().then((u) => setUser(u)).finally(() => setProfilCharge(true))
  }, [isAuthenticated, user?.etat_parcours, setUser])

  const etat = user?.etat_parcours
  const telephoneVerifie = !!(isAuthenticated && etat?.telephone_verifie)

  const valides = [
    isAuthenticated ? !!etat?.infos_personnelles_renseignees : !!(brouillon.nom && brouillon.prenom),
    isAuthenticated ? !!etat?.date_naissance_renseignee : !!(brouillon.jour_naissance && brouillon.mois_naissance),
    telephoneVerifie,
    telephoneVerifie,
    !!commande,
    commande?.statut === 'VALIDEE',
  ]

  // Niveau de départ : le premier qui reste à compléter (commandes suivantes :
  // les informations déjà validées ne sont pas redemandées).
  useEffect(() => {
    if (niveau !== null || !profilCharge) return
    if (isAuthenticated && etat) {
      const premier = [N_IDENTITE, N_NAISSANCE, N_TELEPHONE].find((i) => !valides[i])
      setNiveau(premier ?? N_RECAP)
    } else {
      setNiveau(N_IDENTITE)
    }
  }, [profilCharge, isAuthenticated, etat]) // eslint-disable-line react-hooks/exhaustive-deps

  // Après le niveau courant, aller au prochain niveau non validé
  const suivant = (depuis, etatAJour = etat, connecte = isAuthenticated) => {
    if (connecte && etatAJour) {
      if (depuis < N_RECAP) {
        const manquant = [N_IDENTITE, N_NAISSANCE].find((i) => i > depuis && !(
          i === N_IDENTITE ? etatAJour.infos_personnelles_renseignees : etatAJour.date_naissance_renseignee
        ))
        if (manquant !== undefined) return setNiveau(manquant)
        if (!etatAJour.telephone_verifie) return setNiveau(depuis < N_TELEPHONE ? N_TELEPHONE : N_OTP)
        return setNiveau(N_RECAP)
      }
    }
    setNiveau(depuis + 1)
  }

  const roleNonEtudiant = isAuthenticated && user?.role && !['ETUDIANT', 'ADMIN'].includes(user.role)

  if (!profilCharge || niveau === null) {
    return <PublicLayout masquerPanier><LoadingSpinner className="py-24" size="lg" /></PublicLayout>
  }

  if (roleNonEtudiant) {
    return (
      <PublicLayout masquerPanier>
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-gray-700">Les commandes sont réservées aux comptes étudiants.</p>
          <Link to="/" className="btn-secondary mt-4 inline-flex">Retour</Link>
        </div>
      </PublicLayout>
    )
  }

  if (items.length === 0 && !commande) {
    return (
      <PublicLayout masquerPanier>
        <div className="text-center py-20">
          <ShoppingCart className="h-16 w-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-600 mb-6">Votre panier est vide.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={universite ? `/campus/${universite.id}` : '/campus'} className="btn-primary">Voir les boutiques</Link>
            {isAuthenticated && <Link to="/etudiant/commandes" className="btn-secondary">Mes commandes</Link>}
          </div>
        </div>
      </PublicLayout>
    )
  }

  const props = { brouillon, majEtudiant, user, isAuthenticated, setUser, retour: () => setNiveau(niveau - 1) }

  return (
    <PublicLayout masquerPanier>
      <div className="max-w-lg mx-auto">
        <ParcoursSteps
          niveaux={NIVEAUX.map((label, i) => ({ label, valide: valides[i] }))}
          courant={niveau}
          onSelect={commande ? null : (i) => setNiveau(i === N_OTP ? N_TELEPHONE : i)}
        />

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          {niveau === N_IDENTITE && (
            <NiveauIdentite {...props} retour={null}
              onDejaClient={() => setNiveau(N_TELEPHONE)}
              onSuite={(u) => suivant(N_IDENTITE, u?.etat_parcours)} />
          )}
          {niveau === N_NAISSANCE && (
            <NiveauNaissance {...props} onSuite={(u) => suivant(N_NAISSANCE, u?.etat_parcours)} />
          )}
          {niveau === N_TELEPHONE && (
            <NiveauTelephone {...props}
              onDejaVerifie={() => suivant(N_OTP)}
              onSuite={() => setNiveau(N_OTP)} />
          )}
          {niveau === N_OTP && (
            <NiveauOTP {...props}
              onVerifie={(token, u) => {
                setSession(token, u)
                toast.success('Numéro vérifié')
                suivant(N_OTP, u.etat_parcours, true)
              }} />
          )}
          {niveau === N_RECAP && (
            <NiveauRecap {...props} items={items}
              retour={() => setNiveau(N_NAISSANCE)}
              onCommandeCreee={(c) => { setCommande(c); clearCart(); setNiveau(N_PAIEMENT) }} />
          )}
          {niveau === N_PAIEMENT && commande && (
            <NiveauPaiement commande={commande} onMaj={setCommande}
              onVoir={() => navigate(`/etudiant/commandes/${commande.id}`)} />
          )}
        </div>
      </div>
    </PublicLayout>
  )
}

/* ─────────── Éléments communs ─────────── */
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
        <h1 className="text-lg font-extrabold text-gray-900">{titre}</h1>
        {sousTitre && <p className="text-xs text-gray-500 mt-0.5">{sousTitre}</p>}
      </div>
    </div>
  )
}

function BoutonSuite({ children = 'Continuer', disabled, enCours, ...props }) {
  return (
    <button type="submit" disabled={disabled || enCours} {...props}
      className="w-full mt-6 btn-primary btn-lg disabled:opacity-50 disabled:cursor-not-allowed">
      {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{children} <ArrowRight className="w-4 h-4" /></>}
    </button>
  )
}

// Utilisateur connecté : enregistre la modification sur son profil.
function useEnregistrerProfil(isAuthenticated, setUser) {
  return useMutation({
    mutationFn: (data) => (isAuthenticated ? authApi.updateProfile(data) : Promise.resolve(null)),
    onSuccess: (u) => { if (u) setUser(u) },
    onError: (err) => toast.error(messageErreur(err, "Erreur lors de l'enregistrement")),
  })
}

/* ─────────── Niveau 1 : nom + prénom ─────────── */
function NiveauIdentite({ brouillon, majEtudiant, user, isAuthenticated, setUser, onSuite, onDejaClient }) {
  const [prenom, setPrenom] = useState((isAuthenticated ? user?.prenom : brouillon.prenom) ?? '')
  const [nom, setNom] = useState((isAuthenticated ? user?.nom : brouillon.nom) ?? '')
  const enregistrer = useEnregistrerProfil(isAuthenticated, setUser)

  const soumettre = async (e) => {
    e.preventDefault()
    majEtudiant({ prenom: prenom.trim(), nom: nom.trim() })
    const u = await enregistrer.mutateAsync({ prenom: prenom.trim(), nom: nom.trim() }).catch(() => undefined)
    if (u === undefined) return
    onSuite(u)
  }

  return (
    <form onSubmit={soumettre}>
      <EnTete icon={User} titre="Vos nom et prénom" sousTitre="Pour que le vendeur et le livreur sachent à qui remettre la commande." />
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="prenom">Prénom</label>
          <input id="prenom" className="input" autoFocus autoComplete="given-name" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="nom">Nom</label>
          <input id="nom" className="input" autoComplete="family-name" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
      </div>
      <BoutonSuite disabled={!prenom.trim() || !nom.trim()} enCours={enregistrer.isPending} />
      {!isAuthenticated && (
        <p className="text-center text-sm text-gray-500 mt-4">
          Déjà client ?{' '}
          <button type="button" onClick={onDejaClient} className="text-orange-600 font-semibold hover:text-orange-700">
            Retrouver mes informations avec mon numéro
          </button>
        </p>
      )}
    </form>
  )
}

/* ─────────── Niveau 2 : jour + mois de naissance ─────────── */
function NiveauNaissance({ brouillon, majEtudiant, user, isAuthenticated, setUser, onSuite, retour }) {
  const src = isAuthenticated ? user : brouillon
  const [jour, setJour] = useState(src?.jour_naissance ? String(src.jour_naissance) : '')
  const [mois, setMois] = useState(src?.mois_naissance ? String(src.mois_naissance) : '')
  const enregistrer = useEnregistrerProfil(isAuthenticated, setUser)
  const joursMax = mois ? new Date(2000, Number(mois), 0).getDate() : 31

  const soumettre = async (e) => {
    e.preventDefault()
    const data = { jour_naissance: Number(jour), mois_naissance: Number(mois) }
    majEtudiant(data)
    const u = await enregistrer.mutateAsync(data).catch(() => undefined)
    if (u === undefined) return
    onSuite(u)
  }

  return (
    <form onSubmit={soumettre}>
      <EnTete icon={User} titre="Votre date de naissance" sousTitre="Le jour et le mois seulement — l'année n'est pas demandée." retour={retour} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="jour">Jour</label>
          <select id="jour" className="input" value={jour} onChange={(e) => setJour(e.target.value)}>
            <option value="">—</option>
            {Array.from({ length: joursMax }, (_, i) => i + 1).map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mois">Mois</label>
          <select id="mois" className="input" value={mois}
            onChange={(e) => {
              setMois(e.target.value)
              const max = e.target.value ? new Date(2000, Number(e.target.value), 0).getDate() : 31
              if (Number(jour) > max) setJour('')
            }}>
            <option value="">—</option>
            {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>
      <BoutonSuite disabled={!jour || !mois} enCours={enregistrer.isPending} />
    </form>
  )
}

/* ─────────── Niveau 3 : numéro de téléphone ─────────── */
function NiveauTelephone({ brouillon, majEtudiant, user, isAuthenticated, onSuite, onDejaVerifie, retour }) {
  const verifie = isAuthenticated && user?.telephone_verifie
  const [telephone, setTelephone] = useState(brouillon.telephone || (isAuthenticated ? local8(user?.telephone) : ''))
  const memeNumero = verifie && local8(telephone) === local8(user?.telephone)

  const envoyer = useMutation({
    mutationFn: () => otpApi.envoyer(telephone),
    onSuccess: (res) => {
      majEtudiant({ telephone, debug_code: res?.debug_code ?? null })
      toast.success('Code envoyé par SMS')
      onSuite()
    },
    onError: (err) => toast.error(messageErreur(err, "Impossible d'envoyer le code")),
  })

  const soumettre = (e) => {
    e.preventDefault()
    if (memeNumero) onDejaVerifie()
    else envoyer.mutate()
  }

  return (
    <form onSubmit={soumettre}>
      <EnTete icon={Phone} titre="Votre numéro de téléphone"
        sousTitre="Nous allons vous envoyer un code par SMS pour vérifier ce numéro." retour={retour} />
      <label className="label" htmlFor="telephone">Numéro de téléphone</label>
      <div className="flex gap-2">
        <span className="input w-20 flex-shrink-0 text-center text-gray-500 bg-gray-50">+226</span>
        <input id="telephone" type="tel" inputMode="numeric" autoComplete="tel-national" className="input" autoFocus
          placeholder="70 00 00 00" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
      </div>
      {memeNumero && (
        <p className="flex items-center gap-1.5 text-sm text-green-700 mt-3">
          <ShieldCheck className="w-4 h-4" /> Numéro déjà vérifié
        </p>
      )}
      <BoutonSuite disabled={local8(telephone).length !== 8} enCours={envoyer.isPending}>
        {memeNumero ? 'Continuer' : 'Recevoir le code par SMS'}
      </BoutonSuite>
    </form>
  )
}

/* ─────────── Niveau 4 : code OTP SMS ─────────── */
function NiveauOTP({ brouillon, majEtudiant, isAuthenticated, onVerifie, retour }) {
  const [code, setCode] = useState('')
  const telephone = brouillon.telephone
  const universite = useParcoursStore((s) => s.universite)

  const verifier = useMutation({
    mutationFn: () => parcoursApi.verifierTelephone({
      telephone, code, parcours: 'ETUDIANT',
      // Utilisateur non connecté : les niveaux précédents sont enregistrés à cette occasion
      ...(isAuthenticated ? {} : {
        nom: brouillon.nom || undefined,
        prenom: brouillon.prenom || undefined,
        jour_naissance: brouillon.jour_naissance ? Number(brouillon.jour_naissance) : undefined,
        mois_naissance: brouillon.mois_naissance ? Number(brouillon.mois_naissance) : undefined,
        universite: universite?.id,
      }),
    }),
    onSuccess: (res) => { majEtudiant({ debug_code: null }); onVerifie(res.token, res.user) },
    onError: (err) => { setCode(''); toast.error(messageErreur(err, 'Code invalide ou expiré')) },
  })

  const renvoyer = useMutation({
    mutationFn: () => otpApi.envoyer(telephone),
    onSuccess: (res) => { majEtudiant({ debug_code: res?.debug_code ?? null }); toast.success('Nouveau code envoyé') },
    onError: (err) => toast.error(messageErreur(err, "Impossible d'envoyer le code")),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); verifier.mutate() }}>
      <EnTete icon={MessageSquare} titre="Code reçu par SMS"
        sousTitre={`Saisissez le code à 6 chiffres envoyé au +226 ${local8(telephone)}.`} retour={retour} />

      {brouillon.debug_code && (
        <p className="p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          Mode développement — aucun fournisseur SMS configuré. Code : <span className="font-mono font-bold">{brouillon.debug_code}</span>
        </p>
      )}

      <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
        aria-label="Code de vérification" placeholder="••••••" value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none" />

      <p className="text-xs text-gray-500 mt-3">
        Ce code vérifie uniquement votre numéro. Votre commande n'est pas encore passée : vous verrez ensuite le
        récapitulatif, puis le paiement.
      </p>

      <BoutonSuite disabled={code.length !== 6} enCours={verifier.isPending}>Vérifier mon numéro</BoutonSuite>
      <button type="button" onClick={() => renvoyer.mutate()} disabled={renvoyer.isPending}
        className="w-full mt-3 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50">
        {renvoyer.isPending ? 'Envoi…' : 'Renvoyer le code'}
      </button>
    </form>
  )
}

/* ─────────── Niveau 5 : récapitulatif ─────────── */
function NiveauRecap({ items, user, retour, onCommandeCreee }) {
  const [form, setForm] = useState({
    mode_reception: 'LIVRAISON', salle: '', creneau: '', description_besoin: '',
    telephone_paiement: local8(user?.telephone),
  })
  const maj = (champ) => (e) => setForm((f) => ({ ...f, [champ]: e.target.value }))

  const { data: sallesData, isLoading: chargementSalles } = useQuery({
    queryKey: ['rooms-all'],
    queryFn: () => roomsApi.list({ est_actif: true, page_size: 500 }),
  })
  const salles = Array.isArray(sallesData) ? sallesData : sallesData?.results ?? []
  const { data: creneauxData } = useQuery({
    queryKey: ['creneaux-actifs'],
    queryFn: () => creneauxApi.list({ est_actif: true }),
  })
  const creneaux = Array.isArray(creneauxData) ? creneauxData : creneauxData?.results ?? []
  const { data: config } = useQuery({ queryKey: ['configuration'], queryFn: () => configApi.get() })

  const sousTotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const { frais, total } = useMemo(() => {
    const taux = parseFloat(config?.taux_service ?? 0)
    const f = Math.round((sousTotal * taux) / 100)
    return { frais: f, total: sousTotal + f }
  }, [config, sousTotal])

  const creer = useMutation({
    mutationFn: () => ordersApi.create({
      salle: Number(form.salle),
      mode_reception: form.mode_reception,
      creneau: form.creneau || null,
      methode_paiement: 'ORANGE',
      telephone_paiement: form.telephone_paiement,
      description_besoin: form.description_besoin,
      lignes: items.map((i) => ({
        produit: i.product.id,
        variante: i.variant?.id ?? null,
        options: i.options.map((o) => o.id),
        quantite: i.quantity,
      })),
    }),
    onSuccess: onCommandeCreee,
    onError: (err) => toast.error(messageErreur(err, 'Erreur lors de la création de la commande')),
  })

  const complet = form.salle && local8(form.telephone_paiement).length === 8

  return (
    <form onSubmit={(e) => { e.preventDefault(); creer.mutate() }}>
      <EnTete icon={ShoppingCart} titre="Récapitulatif de la commande" sousTitre="Vérifiez votre commande avant de payer." retour={retour} />

      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mb-4">
        <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span className="truncate">{user?.prenom} {user?.nom} · +226 {local8(user?.telephone)}</span>
      </div>

      <ul className="divide-y divide-gray-100 mb-4">
        {items.map((i) => (
          <li key={i.key} className="flex justify-between gap-3 py-2 text-sm">
            <span className="text-gray-700">
              {i.quantity} × {i.product.nom}{i.variant ? ` (${i.variant.nom})` : ''}
            </span>
            <span className="font-medium text-gray-900 whitespace-nowrap">{(i.unitPrice * i.quantity).toLocaleString('fr-FR')} F</span>
          </li>
        ))}
      </ul>

      <div className="space-y-4">
        <div>
          <p className="label">Mode de réception</p>
          <div className="grid grid-cols-2 gap-2">
            {[['LIVRAISON', 'Livraison', 'Un livreur vous l\'apporte'], ['SUR_PLACE', 'Sur place', 'Retrait chez le vendeur']].map(([v, l, d]) => (
              <label key={v} className={`p-3 rounded-xl border-2 cursor-pointer ${form.mode_reception === v ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
                <input type="radio" name="mode_reception" value={v} checked={form.mode_reception === v} onChange={maj('mode_reception')} className="sr-only" />
                <span className="block font-semibold text-sm text-gray-800">{l}</span>
                <span className="block text-xs text-gray-400">{d}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="salle">Salle</label>
          <select id="salle" className="input" value={form.salle} onChange={maj('salle')} disabled={chargementSalles}>
            <option value="">{chargementSalles ? 'Chargement…' : 'Choisir une salle'}</option>
            {salles.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}{s.batiment ? ` (${s.batiment})` : ''}</option>
            ))}
          </select>
        </div>

        {creneaux.length > 0 && (
          <div>
            <label className="label" htmlFor="creneau">Créneau souhaité</label>
            <select id="creneau" className="input" value={form.creneau} onChange={maj('creneau')}>
              <option value="">Dès que possible</option>
              {creneaux.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="instructions">Instructions (facultatif)</label>
          <textarea id="instructions" rows={2} className="input resize-none" value={form.description_besoin} onChange={maj('description_besoin')} />
        </div>

        <div>
          <label className="label" htmlFor="tel-paiement">Numéro Orange Money pour le paiement</label>
          <input id="tel-paiement" type="tel" inputMode="numeric" className="input" value={form.telephone_paiement} onChange={maj('telephone_paiement')} />
        </div>
      </div>

      <div className="border-t border-gray-100 mt-5 pt-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-500"><span>Sous-total</span><span>{sousTotal.toLocaleString('fr-FR')} FCFA</span></div>
        {frais > 0 && (
          <div className="flex justify-between text-gray-500"><span>Frais de service ({config?.taux_service}%)</span><span>{frais.toLocaleString('fr-FR')} FCFA</span></div>
        )}
        <div className="flex justify-between font-bold text-lg text-gray-900"><span>Total à payer</span><span className="text-primary-500">{total.toLocaleString('fr-FR')} FCFA</span></div>
      </div>

      <BoutonSuite disabled={!complet} enCours={creer.isPending}>Passer au paiement</BoutonSuite>
      <p className="text-xs text-gray-400 text-center mt-2">La commande sera confirmée uniquement après la réussite du paiement.</p>
    </form>
  )
}

/* ─────────── Niveau 6 : paiement ─────────── */
function NiveauPaiement({ commande, onMaj, onVoir }) {
  const [paiement, setPaiement] = useState(null)
  const [codePaiement, setCodePaiement] = useState('')
  const confirmee = commande.statut === 'VALIDEE'

  const initier = useMutation({
    mutationFn: () => paymentsApi.initierPaiement(commande.id),
    onSuccess: setPaiement,
    onError: (err) => toast.error(messageErreur(err, "Erreur lors de l'initiation du paiement")),
  })
  // Une seule initiation automatique (le mode strict de React rejoue les effets)
  const dejaInitie = useRef(false)
  useEffect(() => {
    if (confirmee || dejaInitie.current) return
    dejaInitie.current = true
    initier.mutate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rafraichir = () => ordersApi.get(commande.id).then(onMaj)

  // Paiement validé depuis le téléphone (hors ligne) : suivre la confirmation serveur
  useEffect(() => {
    if (confirmee || !paiement || paiement.statut === 'send_otp' || paiement.statut === 'failed') return undefined
    const id = setInterval(rafraichir, 5000)
    return () => clearInterval(id)
  }, [paiement, confirmee]) // eslint-disable-line react-hooks/exhaustive-deps

  const payer = useMutation({
    mutationFn: () => paymentsApi.soumettreOtp(commande.id, codePaiement),
    onSuccess: () => rafraichir(),
    onError: (err) => {
      setCodePaiement('')
      setPaiement((p) => (p ? { ...p, statut: err?.response?.data?.statut ?? p.statut } : p))
      toast.error(messageErreur(err, 'Paiement échoué'))
    },
  })

  if (confirmee) {
    return (
      <div className="text-center py-4">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
        <h1 className="text-xl font-extrabold text-gray-900">Commande confirmée</h1>
        <p className="text-sm text-gray-500 mt-1">Paiement reçu — commande n° <span className="font-mono">{commande.numero_commande}</span></p>
        <button type="button" onClick={onVoir} className="btn-primary btn-lg w-full mt-6">Suivre ma commande</button>
      </div>
    )
  }

  return (
    <div>
      <EnTete icon={CreditCard} titre="Paiement" sousTitre={`Commande n° ${commande.numero_commande} — en attente de paiement`} />

      <div className="flex items-center gap-3 p-3 rounded-2xl border-2 border-orange-300 bg-orange-50 mb-4">
        <img src={orangeLogo} alt="" className="h-10 w-10 rounded-xl object-cover" />
        <div>
          <p className="font-bold text-orange-700">Orange Money</p>
          <p className="text-xs text-orange-600">{parseFloat(commande.total_ttc).toLocaleString('fr-FR')} FCFA · +226 {local8(commande.telephone_paiement)}</p>
        </div>
      </div>

      {initier.isPending && (
        <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Initiation du paiement…</p>
      )}

      {paiement?.display_text && (
        <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 mb-4">{paiement.display_text}</p>
      )}

      {paiement?.statut === 'send_otp' && (
        <form onSubmit={(e) => { e.preventDefault(); payer.mutate() }}>
          <label className="label" htmlFor="code-paiement">Code de paiement Orange Money</label>
          <input id="code-paiement" type="text" inputMode="numeric" maxLength={8} value={codePaiement}
            onChange={(e) => setCodePaiement(e.target.value.replace(/\D/g, ''))}
            className="input text-center text-xl font-mono tracking-widest" />
          <p className="text-xs text-gray-500 mt-2">Ce code est fourni par Orange Money pour autoriser le paiement.</p>
          <BoutonSuite disabled={codePaiement.length < 4} enCours={payer.isPending}>Payer {parseFloat(commande.total_ttc).toLocaleString('fr-FR')} FCFA</BoutonSuite>
        </form>
      )}

      {paiement && !['send_otp', 'failed'].includes(paiement.statut) && (
        <p className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> Validez le paiement sur votre téléphone. Cette page se met à jour automatiquement.
        </p>
      )}

      {((initier.isError && !paiement) || paiement?.statut === 'failed') && (
        <button type="button" onClick={() => initier.mutate()} className="btn-primary btn-lg w-full mt-4">Réessayer le paiement</button>
      )}

      <button type="button" onClick={onVoir} className="w-full mt-4 text-sm text-gray-500 hover:text-gray-800">
        Payer plus tard depuis « Mes commandes »
      </button>
    </div>
  )
}
