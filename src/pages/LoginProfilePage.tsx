import { useState, type FormEvent } from 'react';
import { APP_NAME, APP_TITLE } from '../lib/constants';
import { useAppContext } from '../hooks/AppDataContext';

export function LoginProfilePage() {
  const { access } = useAppContext();
  const [matricula, setMatricula] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!matricula.trim()) return;
    access.loginWithMatricula(matricula.trim());
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--background)', padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <img src="./logo-equatorial-white.png" alt="Grupo Equatorial" style={{ width: 120, background: 'var(--navy-900)', borderRadius: 10, padding: 12, marginBottom: 18 }} />
        <h1 className="section-title" style={{ fontSize: 18 }}>
          {APP_TITLE}
        </h1>
        <p className="section-subtitle" style={{ margin: '4px 0 18px' }}>
          Informe sua matrícula corporativa para acessar o {APP_NAME}. Em produção, esta etapa pode ser
          substituída por login com e-mail corporativo (Supabase Auth).
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Matrícula corporativa</label>
            <input value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="u1205385" autoFocus />
          </div>
          <button className="btn" type="submit" style={{ width: '100%' }}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
