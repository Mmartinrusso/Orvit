import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);

    // In production, log to error tracking service (Sentry, etc.)
    if (import.meta.env.PROD) {
      // TODO: Send to error tracking service
      // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-dark-surface rounded-lg shadow-lg p-8">
            {/* Error Icon */}
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>

            {/* Error Title */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text text-center mb-4">
              Algo salió mal
            </h1>

            {/* Error Message */}
            <p className="text-gray-600 dark:text-dark-text-secondary text-center mb-6">
              Lo sentimos, ocurrió un error inesperado. Puedes intentar recargar la página o volver al inicio.
            </p>

            {/* Error Details (Development Only) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm font-mono text-red-800 dark:text-red-300 mb-2">
                  <strong>Error:</strong> {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-sm font-semibold text-red-700 dark:text-red-400 cursor-pointer">
                      Component Stack
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                variant="primary"
                className="flex items-center justify-center"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Intentar de nuevo
              </Button>
              <Button
                onClick={this.handleReload}
                variant="outline"
                className="flex items-center justify-center"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Recargar página
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="ghost"
                className="flex items-center justify-center"
              >
                <Home className="w-4 h-4 mr-2" />
                Ir al inicio
              </Button>
            </div>

            {/* Support Link */}
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary text-center mt-6">
              Si el problema persiste, contacta al equipo de soporte.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper component
 * Use this for simpler error boundaries without state
 */
interface SimpleErrorBoundaryProps {
  children: ReactNode;
}

export function SimpleErrorBoundary({ children }: SimpleErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Error caught by SimpleErrorBoundary:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
