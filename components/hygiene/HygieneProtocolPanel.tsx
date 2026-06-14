type Props = {
  description?: string | null;
  cleaningProtocol: string;
  disinfectionProtocol: string;
  productUsed?: string | null;
  dosage?: string | null;
  contactTime?: string | null;
};

export function HygieneProtocolPanel({
  description,
  cleaningProtocol,
  disinfectionProtocol,
  productUsed,
  dosage,
  contactTime,
}: Props) {
  if (!cleaningProtocol && !disinfectionProtocol) return null;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-copper-100 bg-copper-50/50 p-3 text-xs text-stone-700">
      <p className="font-semibold text-stone-900">Protocole à suivre</p>
      {description ? <p className="text-stone-600">{description}</p> : null}
      {cleaningProtocol ? (
        <div>
          <p className="font-medium text-stone-800">Nettoyage</p>
          <pre className="mt-0.5 whitespace-pre-wrap font-sans leading-relaxed">{cleaningProtocol}</pre>
        </div>
      ) : null}
      {disinfectionProtocol ? (
        <div>
          <p className="font-medium text-stone-800">Désinfection</p>
          <pre className="mt-0.5 whitespace-pre-wrap font-sans leading-relaxed">{disinfectionProtocol}</pre>
        </div>
      ) : null}
      {(productUsed || dosage || contactTime) && (
        <p className="border-t border-copper-100 pt-2 text-stone-600">
          {productUsed ? <span>Produit : {productUsed}. </span> : null}
          {dosage ? <span>Dosage : {dosage}. </span> : null}
          {contactTime ? <span>Temps de contact : {contactTime}.</span> : null}
        </p>
      )}
    </div>
  );
}
