import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Brouillon des informations saisies dans les parcours progressifs
 * (étudiant et vendeur), conservé pour pouvoir revenir à une étape
 * précédente — ou rouvrir la page — sans perdre ce qui a été saisi.
 */
const useParcoursStore = create(
  persist(
    (set) => ({
      universite: null, // { id, nom } — choix du campus (niveau 0)
      etudiant: { nom: '', prenom: '', jour_naissance: '', mois_naissance: '', telephone: '' },
      vendeur: { nom: '', prenom: '', telephone: '' },

      choisirUniversite: (universite) => set({ universite }),
      majEtudiant: (champs) => set((s) => ({ etudiant: { ...s.etudiant, ...champs } })),
      majVendeur: (champs) => set((s) => ({ vendeur: { ...s.vendeur, ...champs } })),
      reinitialiser: () => set({
        etudiant: { nom: '', prenom: '', jour_naissance: '', mois_naissance: '', telephone: '' },
        vendeur: { nom: '', prenom: '', telephone: '' },
      }),
    }),
    { name: 'ritoto-parcours' }
  )
)

export default useParcoursStore
