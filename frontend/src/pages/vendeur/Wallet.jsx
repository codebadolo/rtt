import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Wallet } from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { walletApi } from '../../api/orders'

function StatCard({ label, value, icon: Icon, color }) {
  const c = {
    green:  'bg-green-100 text-green-600',
    blue:   'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
  }[color] ?? 'bg-gray-100 text-gray-600'
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-xl flex-shrink-0 ${c}`}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function VendeurWallet() {
  const { data: wallet, isLoading: loadingWallet } = useQuery({
    queryKey: ['vendeur-wallet'],
    queryFn: walletApi.get,
    refetchInterval: 30000,
  })

  const { data: txData, isLoading: loadingTx } = useQuery({
    queryKey: ['vendeur-transactions'],
    queryFn: () => walletApi.transactions({ page_size: 50 }),
  })

  const transactions = Array.isArray(txData) ? txData : txData?.results ?? []

  if (loadingWallet) return <DashboardLayout><LoadingSpinner size="xl" className="py-32" /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Mon Wallet</h1>

        {/* Solde principal */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl p-6 text-white shadow-lg">
          <p className="text-orange-100 text-sm font-medium">Solde disponible</p>
          <p className="text-4xl font-extrabold mt-1">
            {parseFloat(wallet?.solde ?? 0).toLocaleString('fr-FR')} <span className="text-xl font-semibold text-orange-200">FCFA</span>
          </p>
          <p className="text-orange-200 text-xs mt-3">Mis à jour automatiquement après chaque livraison</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={TrendingUp} label="Total encaissé" color="green"
            value={`${parseFloat(wallet?.total_encaisse ?? 0).toLocaleString('fr-FR')} F`} />
          <StatCard icon={ArrowUpRight} label="Commissions Ritôtô" color="orange"
            value={`${parseFloat(wallet?.total_commissions ?? 0).toLocaleString('fr-FR')} F`} />
          <StatCard icon={Wallet} label="Solde net" color="blue"
            value={`${parseFloat(wallet?.solde ?? 0).toLocaleString('fr-FR')} F`} />
        </div>

        {/* Historique transactions */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Historique des transactions</h2>
          </div>

          {loadingTx ? (
            <div className="py-12"><LoadingSpinner size="lg" /></div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Aucune transaction pour l'instant</p>
              <p className="text-sm text-gray-400 mt-1">Vos revenus apparaîtront ici après chaque livraison validée</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 px-6 py-4">
                  <div className={`p-2 rounded-xl flex-shrink-0 ${tx.type_transaction === 'CREDIT' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {tx.type_transaction === 'CREDIT'
                      ? <ArrowDownLeft className="h-4 w-4 text-green-600" />
                      : <ArrowUpRight className="h-4 w-4 text-red-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {tx.type_transaction === 'CREDIT' ? 'Vente livrée' : 'Débit'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{tx.note || tx.commande_numero || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold ${tx.type_transaction === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.type_transaction === 'CREDIT' ? '+' : '-'}
                      {parseFloat(tx.montant ?? 0).toLocaleString('fr-FR')} F
                    </p>
                    {tx.commission > 0 && (
                      <p className="text-xs text-gray-400">comm. {parseFloat(tx.commission).toLocaleString('fr-FR')} F</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.date_creation).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
