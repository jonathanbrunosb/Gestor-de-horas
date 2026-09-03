interface SimpleBarChartProps {
  title: string;
  legendLabel: string;
  orientation: 'vertical' | 'horizontal';
  data: Array<{ key: string; label: string; count: number }>;
}

/**
 * Gráfico de barras simples, sem biblioteca externa (o projeto não tem
 * nenhuma dependência de gráficos até agora — para dois gráficos de barra
 * únicos, divs proporcionais bastam e evitam adicionar uma dependência só
 * para isso). Usado pela tela KPIs - Classe A (Total de ocorrências por mês
 * e por tipo).
 */
export function SimpleBarChart({ title, legendLabel, orientation, data }: SimpleBarChartProps) {
  const maxValue = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="card kpi-chart-card">
      <h2 className="section-title" style={{ marginBottom: 2 }}>
        {title}
      </h2>
      <div className="kpi-chart-legend">
        <span className="small-text muted">Ano</span>
        <span className="kpi-chart-legend-dot" />
        <span className="small-text">{legendLabel}</span>
      </div>

      {total === 0 ? (
        <p className="small-text muted" style={{ marginTop: 24, textAlign: 'center' }}>
          Nenhuma ocorrência no período selecionado.
        </p>
      ) : orientation === 'vertical' ? (
        <div className="kpi-bars-vertical">
          {data.map((d) => (
            <div className="kpi-bar-vertical-item" key={d.key}>
              <span className="kpi-bar-value">{d.count}</span>
              <div className="kpi-bar-vertical-track">
                <div className="kpi-bar-vertical-fill" style={{ height: `${(d.count / maxValue) * 100}%` }} />
              </div>
              <span className="small-text kpi-bar-label">{d.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="kpi-bars-horizontal">
          {data.map((d) => (
            <div className="kpi-bar-horizontal-item" key={d.key}>
              <span className="small-text kpi-bar-horizontal-label" title={d.label}>
                {d.label}
              </span>
              <div className="kpi-bar-horizontal-track">
                <div className="kpi-bar-horizontal-fill" style={{ width: `${(d.count / maxValue) * 100}%` }} />
              </div>
              <span className="kpi-bar-value">{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
