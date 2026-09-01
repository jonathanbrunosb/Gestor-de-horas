import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Nunca deixa a tela em branco em caso de erro — exibe um estado de fallback com opção de recarregar. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Erro não tratado na aplicação:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--background)', padding: 24 }}>
          <div className="card" style={{ maxWidth: 460, textAlign: 'center' }}>
            <h2 className="section-title">Ocorreu um erro inesperado</h2>
            <p className="section-subtitle" style={{ margin: '4px 0 16px' }}>
              {this.state.error.message || 'A aplicação encontrou um problema e não pôde continuar.'}
            </p>
            <button className="btn" onClick={() => window.location.reload()}>
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
