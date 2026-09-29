import { SCHEMA_ORG, serializeJsonLd, type JsonLdNode } from '@/lib/seo';

export interface JsonLdProps {
  nodes: readonly JsonLdNode[];
}

export function JsonLd({ nodes }: JsonLdProps) {
  if (nodes.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd({ '@context': SCHEMA_ORG, '@graph': nodes }),
      }}
    />
  );
}
