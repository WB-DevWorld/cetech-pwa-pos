export type TechnicalDetailRow = {
  readonly label: string;
  readonly value: string;
};

export function TechnicalDetails({
  rows,
  title = "Technical details",
}: {
  readonly rows: readonly TechnicalDetailRow[];
  readonly title?: string;
}) {
  const visible = rows.filter((row) => row.value.trim().length > 0);
  if (visible.length === 0) return null;
  return (
    <details className="technical-details">
      <summary>{title}</summary>
      <dl>
        {visible.map((row) => (
          <div key={`${row.label}:${row.value}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
