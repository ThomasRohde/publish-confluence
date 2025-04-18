import { Component } from 'preact';

/**
 * Error Boundary component that catches JavaScript errors in its child component tree
 * Designed to work well within Confluence HTML macros
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service
    console.error('Dashboard error caught by ErrorBoundary:', error);
    console.error('Component stack:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="error-container">
          <h3>Dashboard Error</h3>
          <p>Something went wrong while rendering the dashboard.</p>
          <p className="error-message">{this.state.error?.message || 'Unknown error'}</p>
          <button 
            className="dashboard-button dashboard-button-primary" 
            onClick={() => window.location.reload()}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}