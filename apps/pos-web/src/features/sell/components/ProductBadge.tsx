import type { ProductBadgeView } from "../state/productPresentation";

export function ProductBadge({ badge }: { badge: ProductBadgeView }) {
  return <span className={`product-badge ${badge.tone}`}>{badge.label}</span>;
}

export function ProductBadgeList({ badges }: { badges: readonly ProductBadgeView[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="product-badges">
      {badges.map((badge) => (
        <ProductBadge key={badge.id} badge={badge} />
      ))}
    </div>
  );
}
