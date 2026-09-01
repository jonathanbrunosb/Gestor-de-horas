import { Link } from 'react-router-dom';
import { useAppContext } from '../hooks/AppDataContext';
import { canManageAccessProfiles } from '../lib/permissions';

export function AccessDeniedPage() {
  const { access } = useAppContext();
  const { context } = access;

  const originLabel = context.source === 'query' ? 'Query string' : context.source === 'session' ? 'Sessão local' : context.source === 'auth' ? 'Login' : '-';

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--background)', padding: 24 }}>
      <div className="card" style={{ maxWidth: 520, width: '100%' }}>
        <h1 className="section-title" style={{ fontSize: 18, color: 'var(--danger)' }}>
          Acesso não autorizado
        </h1>
        <div className="alert-box" style={{ marginTop: 12 }}>
          <span className="alert-box-icon">!</span>
          <div>
            <h3>Colaborador sem acesso cadastrado</h3>
            <p>
              O sistema identificou a matrícula <strong>{context.matricula || '(não identificada)'}</strong>, porém não existe
              perfil ativo cadastrado para acesso. Por segurança, os saldos, controles e bases foram ocultados.
            </p>
          </div>
        </div>

        <div className="grid cards-3" style={{ marginTop: 16 }}>
          <div className="mini-stat">
            <div className="mini-label">Saldos exibidos</div>
            <div className="mini-value">--:--</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Perfil encontrado</div>
            <div className="mini-value" style={{ fontSize: 12.5 }}>
              {context.profile ? context.role : 'Sem perfil cadastrado'}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Origem</div>
            <div className="mini-value" style={{ fontSize: 12.5 }}>
              {originLabel}
            </div>
          </div>
        </div>

        <p className="small-text" style={{ marginTop: 14 }}>
          {context.reason}
        </p>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="btn secondary" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              access.logout();
            }}
          >
            Voltar ao login
          </button>
          {context.profile && canManageAccessProfiles(context.profile.access_type) && (
            <Link className="btn" to="/configuracoes">
              Cadastrar perfil de acesso
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
