from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random

from apps.authentification.models import Utilisateur, VerificationKYC

class Command(BaseCommand):
    help = 'Génère des utilisateurs de test'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=50, help='Nombre d\'utilisateurs à créer')

    def handle(self, *args, **options):
        count = options['count']
        
        noms = ['Koffi', 'Konan', 'Kouadio', 'N\'Guessan', 'Yao', 'Kouassi', 'Amani', 'Brou', 'Kra', 'Ahoussi']
        prenoms = ['Jean', 'Marie', 'Paul', 'Pierre', 'François', 'Anne', 'Sophie', 'David', 'Emmanuel', 'Catherine']
        
        for i in range(count):
            email = f"test.user{i+1}@gmail.com"
            if Utilisateur.objects.filter(email=email).exists():
                continue

            role = random.choice(['ETUDIANT', 'ETUDIANT', 'ETUDIANT', 'LIVREUR', 'CHEF_SECTEUR'])
            statut_kyc = 'VALIDE' if role != 'ETUDIANT' else random.choice(['VALIDE', 'EN_ATTENTE', 'REJETE'])
            
            user = Utilisateur.objects.create_user(
                email=email,
                password='password123',
                nom=random.choice(noms),
                prenom=random.choice(prenoms),
                telephone=f"07{random.randint(10000000, 99999999)}",
                role=role,
                statut_kyc=statut_kyc,
                est_actif=True
            )

            if role == 'ETUDIANT' and statut_kyc != 'NON_SOUMIS':
                VerificationKYC.objects.create(
                    utilisateur=user,
                    numero_carte=f"CARTE{random.randint(10000, 99999)}",
                )

        self.stdout.write(self.style.SUCCESS(f'✅ {count} utilisateurs créés'))
