const clockIcon = (
  <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7.5 4v3.5l2.5 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const gearIcon = (
  <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M6.3 1.8l-.3 1.1a5 5 0 00-.9.5l-1.1-.4-1 1.7 1 .8v1l-1 .8 1 1.7 1.1-.4c.27.2.57.37.9.5l.3 1.2h1.9l.3-1.2c.32-.13.62-.3.9-.5l1.1.4 1-1.7-1-.8v-1l1-.8-1-1.7-1.1.4a5 5 0 00-.9-.5l-.3-1.1H6.3z"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const shieldIcon = (
  <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1.5l5 1.8v4c0 3.2-2.1 5.5-5 6.2-2.9-.7-5-3-5-6.2v-4l5-1.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M5.3 7.5l1.5 1.5 3-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RULE_ITEMS = [
  {
    icon: clockIcon,
    title: 'Descanso mínimo: 11 horas',
    text: 'Período mínimo de descanso entre o fim de uma jornada e o início da próxima.'
  },
  {
    icon: gearIcon,
    title: 'Margem operacional: +1 minuto',
    text: 'Adicionado ao horário técnico mínimo como margem de segurança.'
  },
  {
    icon: shieldIcon,
    title: 'Base: ACT / Interjornada',
    text: 'Cálculo realizado conforme Acordo Coletivo de Trabalho e premissa vigente.'
  }
];

/** Card "Regra aplicada" — explica, de forma estática, a premissa usada pelo Simulador de Jornada. */
export function JourneyRuleCard() {
  return (
    <div className="card">
      <h2 className="section-title" style={{ marginBottom: 2 }}>
        Regra aplicada
      </h2>
      <p className="section-subtitle">Cálculo realizado conforme as regras de interjornada vigentes.</p>

      <div className="alert-box info" style={{ marginBottom: 4 }}>
        <span className="alert-box-icon">i</span>
        <p style={{ margin: 0 }}>O simulador considera as regras da convenção e acordos coletivos aplicáveis à sua empresa.</p>
      </div>

      {RULE_ITEMS.map((item) => (
        <div className="journey-rule-item" key={item.title}>
          <span className="journey-rule-icon">{item.icon}</span>
          <div>
            <div className="journey-rule-title">{item.title}</div>
            <div className="journey-rule-text">{item.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
