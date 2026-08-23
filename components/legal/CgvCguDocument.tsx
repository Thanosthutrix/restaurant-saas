import Link from "next/link";
import { PublicLayoutShell } from "@/components/public/PublicLayoutShell";
import { UBION_LEGAL } from "@/lib/legal/companyMentions";

const UPDATED_AT = "23 août 2026";

export function CgvCguDocument() {
  const { forme, capital, rcsVille, siren, siege, hebergeur, contactEmail } = UBION_LEGAL;

  return (
    <PublicLayoutShell headerMode="pro">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Ubion</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
          Conditions générales de vente et d&apos;utilisation (CGV / CGU)
        </h1>
        <p className="mt-2 text-sm text-stone-500">Dernière mise à jour : {UPDATED_AT}</p>

        <div className="prose-legal mt-8 space-y-8 text-sm leading-relaxed text-stone-700">
          <p>
            Les présentes conditions générales de vente et d&apos;utilisation (« CGV/CGU ») régissent
            l&apos;accès et l&apos;utilisation des services édités par la société Ubion, incluant
            l&apos;application SaaS Ubion Pro (réservée aux professionnels de la restauration) et le
            portail public ubion.fr.
          </p>
          <p>
            Toute souscription ou utilisation du service implique l&apos;acceptation pleine, entière et
            sans réserve des présentes conditions par le Client.
          </p>

          <hr className="border-stone-200" />

          <section>
            <h2 className="text-lg font-semibold text-stone-900">
              1. Mentions légales et objet du service
            </h2>
            <div className="mt-3 space-y-3">
              <p>
                Le service est édité par la société <strong>Ubion</strong>, {forme} au capital de{" "}
                {capital} €, immatriculée au Registre du Commerce et des Sociétés de {rcsVille} sous le
                numéro {siren}, dont le siège social est situé {siege}.
                <br />
                Contact :{" "}
                <a href={`mailto:${contactEmail}`} className="font-medium text-orange-700 hover:underline">
                  {contactEmail}
                </a>
                .
                <br />
                Hébergement des données : {hebergeur}.
              </p>
              <p>
                Ubion est une solution logicielle en ligne (mode SaaS) destinée à accompagner les
                professionnels de la restauration dans le pilotage de leurs opérations internes (stocks,
                fiches techniques, planning et suivi des temps, gestion des contrôles d&apos;hygiène/HACCP,
                pré-analyse de marge) et l&apos;animation de leur présence digitale.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900">
              2. Accès au service et création de compte
            </h2>
            <div className="mt-3 space-y-3">
              <p>
                <strong>2.1. Qualité du Client :</strong> Ubion Pro est un service exclusivement réservé
                aux personnes physiques ou morales agissant dans le cadre de leur activité professionnelle
                (restaurateurs, gérants, exploitants).
              </p>
              <p>
                <strong>2.2. Identifiants :</strong> Le Client est seul garant de l&apos;exactitude des
                informations transmises et de la stricte confidentialité de ses identifiants. Toute action
                effectuée depuis le compte du Client est réputée avoir été réalisée par lui-même ou sous sa
                supervision.
              </p>
              <p>
                <strong>2.3. Période d&apos;essai :</strong> Les périodes d&apos;essai gratuites sont
                accordées à titre discrétionnaire par Ubion et peuvent être suspendues ou closes à tout
                moment sans préavis.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900">
              3. Tarifs, facturation et modalités de paiement
            </h2>
            <div className="mt-3 space-y-3">
              <p>
                <strong>3.1. Tarifs :</strong> Les tarifs des abonnements (mensuels ou annuels) sont
                indiqués en Euros Hors Taxes (HT) sur le site ubion.fr et confirmés lors de la
                souscription. Ils sont soumis à la TVA au taux légal en vigueur.
              </p>
              <p>
                <strong>3.2. Paiement :</strong> Le paiement s&apos;effectue par carte bancaire
                professionnelle ou prélèvement SEPA via notre prestataire de paiement sécurisé Stripe. Le
                débit intervient automatiquement au début de chaque période d&apos;abonnement (terme à
                échoir).
              </p>
              <p>
                <strong>3.3. Reconduction tacite :</strong> Sauf résiliation dans les conditions prévues à
                l&apos;Article 9, l&apos;abonnement se renouvelle automatiquement et tacitement pour des
                durées successives identiques à la période initiale souscrite (mensuelle ou annuelle).
              </p>
              <p>
                <strong>3.4. Retard ou défaut de paiement :</strong> Tout retard de paiement entraîne de
                plein droit, sans mise en demeure préalable :
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  L&apos;application de pénalités de retard au taux d&apos;intérêt appliqué par la BCE à
                  son opération de refinancement la plus récente majoré de 10 points ;
                </li>
                <li>
                  Une indemnité forfaitaire légale pour frais de recouvrement de 40 € (art. L441-10 et
                  D441-5 du Code de commerce) ;
                </li>
                <li>
                  La suspension immédiate de l&apos;accès à Ubion Pro jusqu&apos;à régularisation complète.
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900">
              4. Obligations du Client et utilisation acceptable
            </h2>
            <p className="mt-3">Le Client s&apos;engage expressément à :</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                Utiliser la solution dans le respect strict des réglementations en vigueur, notamment en
                matière de droit du travail, de droit social, de normes sanitaires et d&apos;hygiène
                alimentaire (HACCP) ;
              </li>
              <li>
                Ne pas exploiter le service à des fins illicites, ne pas tenter de porter atteinte à
                l&apos;intégrité ou à la sécurité technique de la plateforme ;
              </li>
              <li>
                Détenir l&apos;ensemble des droits de propriété intellectuelle sur les éléments intégrés
                dans l&apos;outil (logos, photographies, descriptions de cartes et menus) et garantir Ubion
                contre tout recours de tiers à ce titre.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900">
              5. Responsabilité et décharge de conseil (Obligation de moyens)
            </h2>
            <div className="mt-3 space-y-3">
              <p>
                <strong>5.1. Nature de l&apos;engagement :</strong> Ubion est soumis à une{" "}
                <strong>obligation de moyens</strong> pour la fourniture et la maintenance de ses services
                SaaS.
              </p>
              <p>
                <strong>5.2. Outil d&apos;aide à la décision :</strong> Ubion constitue un progiciel
                d&apos;aide à la gestion technique et opérationnelle. Ubion{" "}
                <strong>
                  n&apos;est en aucun cas un cabinet d&apos;expertise comptable, un cabinet de conseil
                  juridique, un contrôleur sanitaire assermenté ou un organisme de certification HACCP.
                </strong>
              </p>
              <p>
                <strong>5.3. Exclusion de responsabilité :</strong> Le Client conserve l&apos;entière
                responsabilité de la vérification matérielle de ses stocks, du respect de la chaîne du
                froid, de la validation des heures effectives de travail de ses collaborateurs et de
                l&apos;exactitude de ses déclarations légales, fiscales et comptables. Ubion ne saurait
                être tenu responsable des conséquences directes ou indirectes résultant :
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  D&apos;une fermeture administrative, d&apos;une sanction ou d&apos;un procès-verbal
                  dressé par les autorités sanitaires (DDPP / DDecPP) ;
                </li>
                <li>
                  D&apos;un redressement fiscal, d&apos;un contrôle URSSAF ou d&apos;un litige prud&apos;homomal
                  avec un salarié ;
                </li>
                <li>
                  D&apos;une perte d&apos;exploitation, d&apos;un manque à gagner ou d&apos;une perte de
                  données consécutive à une mauvaise saisie ou une négligence du Client.
                </li>
              </ul>
              <p>
                <strong>5.4. Plafond d&apos;indemnisation :</strong> Dans tous les cas où la
                responsabilité d&apos;Ubion viendrait à être engagée, le montant total des indemnités dues
                par Ubion sera expressément plafonné aux sommes effectivement perçues par Ubion auprès du
                Client au titre des douze (12) mois précédant l&apos;événement dommageable.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900">
              6. Protection des données personnelles (RGPD)
            </h2>
            <div className="mt-3 space-y-3">
              <p>
                <strong>6.1. Ubion en tant que Responsable de Traitement :</strong> Ubion traite les
                données de contact et de facturation du Client pour la gestion de la relation
                contractuelle, conformément à sa{" "}
                <Link href="/legal/privacy" className="font-medium text-orange-700 hover:underline">
                  Politique de Confidentialité
                </Link>
                .
              </p>
              <p>
                <strong>6.2. Ubion en tant que Sous-traitant :</strong> Lorsque le Client enregistre sur
                la plateforme des données relatives à son personnel (heures pointées, noms) ou à sa
                clientèle, le Client est seul Responsable du Traitement au sens du RGPD. Ubion agit
                exclusivement sur instruction documentée du Client pour assurer l&apos;hébergement et la
                maintenance technique. Ubion s&apos;engage à mettre en œuvre les mesures techniques et
                organisationnelles appropriées pour garantir la sécurité et la confidentialité desdites
                données.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900">7. Propriété intellectuelle</h2>
            <div className="mt-3 space-y-3">
              <p>
                <strong>7.1.</strong> L&apos;ensemble des droits de propriété intellectuelle afférents au
                logiciel Ubion, à ses codes sources, interfaces, bases de données, chartes graphiques et
                marques demeurent la propriété exclusive d&apos;Ubion. La souscription concède uniquement
                au Client une licence d&apos;utilisation non exclusive, personnelle et non transférable
                pour la durée de l&apos;abonnement.
              </p>
              <p>
                <strong>7.2.</strong> Le Client demeure propriétaire exclusif des données et contenus
                qu&apos;il renseigne. Il concède à Ubion une licence d&apos;hébergement technique
                nécessaire à la seule exécution du service.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900">8. Disponibilité et maintenance</h2>
            <p className="mt-3">
              Ubion s&apos;efforce de maintenir une disponibilité de service optimale 24h/24 et 7j/7, mais
              ne garantit pas un fonctionnement ininterrompu. Des interruptions pour maintenance technique
              corrective ou évolutive peuvent intervenir. Ubion s&apos;engage à en informer le Client dans
              un délai raisonnable par notification ou e-mail lorsque la maintenance affecte
              significativement l&apos;accès.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900">
              9. Durée, résiliation et réversibilité des données
            </h2>
            <div className="mt-3 space-y-3">
              <p>
                <strong>9.1. Résiliation par le Client :</strong> Le Client peut résilier son abonnement à
                tout moment avant la date d&apos;échéance de la période en cours directement depuis le
                portail de facturation Stripe ou par e-mail. Tout mois ou année entamé reste intégralement
                dû et ne donne lieu à aucun remboursement prorata temporis.
              </p>
              <p>
                <strong>9.2. Résiliation pour faute :</strong> Ubion se réserve le droit de résilier ou
                suspendre l&apos;accès sans préavis en cas de manquement grave du Client (défaut de
                paiement, tentative de piratage, violation des lois applicables).
              </p>
              <p>
                <strong>9.3. Récupération des données :</strong> À la fin du contrat, le Client dispose
                d&apos;un délai de trente (30) jours pour exporter ses données (formats standard CSV/PDF).
                Passé ce délai, Ubion procédera à la purge et à la suppression définitive des bases de
                données du Client.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900">
              10. Droit applicable et juridiction compétente
            </h2>
            <div className="mt-3 space-y-3">
              <p>Les présentes CGV/CGU sont régies par le droit français.</p>
              <p className="font-semibold uppercase leading-relaxed text-stone-800">
                Tout litige relatif à leur validité, leur interprétation, leur exécution ou leur
                résiliation, qui n&apos;aurait pu faire l&apos;objet d&apos;un accord amiable préalable,
                sera soumis à la compétence exclusive du tribunal de commerce du ressort du siège social
                d&apos;Ubion, même en cas de pluralité de défendeurs ou d&apos;appel en garantie.
              </p>
            </div>
          </section>
        </div>

        <p className="mt-12 border-t border-stone-200 pt-6 text-sm text-stone-500">
          Questions :{" "}
          <a href={`mailto:${contactEmail}`} className="font-medium text-orange-700 hover:underline">
            {contactEmail}
          </a>
          {" · "}
          <Link href="/legal/privacy" className="hover:text-stone-700">
            Politique de confidentialité
          </Link>
        </p>
      </article>
    </PublicLayoutShell>
  );
}
