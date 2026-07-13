type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

/** Données structurées schema.org (Google, Bing, etc.). */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
