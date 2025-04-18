import { render } from 'preact';
import { Controls } from './components/Controls';
import { Dashboard } from './components/Dashboard';
import { DataTable } from './components/DataTable';
import { DistributionChart } from './components/DistributionChart';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SummaryMetrics } from './components/SummaryMetrics';
import { TrendChart } from './components/TrendChart';
import './styles/main.css';

// Initialize the application once DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Hide loading indicator
    const loadingElement = document.getElementById('dashboard-loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    // Show dashboard container
    const appElement = document.getElementById('dashboard-app');
    if (appElement) {
      appElement.style.display = 'block';
    }

    // Create a controller component that will manage state but not create DOM structure
    const dashboardController = document.getElementById('dashboard-app');
    render(
      <ErrorBoundary>
        <Dashboard 
          renderControls={(props) => {
            const controlsContainer = document.getElementById('controls-container');
            if (controlsContainer) {
              render(<Controls {...props} />, controlsContainer);
            }
          }}
          renderSummaryMetrics={(props) => {
            const container = document.getElementById('summary-metrics');
            if (container) {
              render(<SummaryMetrics {...props} />, container);
            }
          }}
          renderTrendChart={(props) => {
            const container = document.getElementById('trend-chart');
            if (container) {
              render(<TrendChart {...props} />, container);
            }
          }}
          renderDistributionChart={(props) => {
            const container = document.getElementById('distribution-chart');
            if (container) {
              render(<DistributionChart {...props} />, container);
            }
          }}
          renderDataTable={(props) => {
            const container = document.getElementById('data-table');
            if (container) {
              render(<DataTable {...props} />, container);
            }
          }}
        />
      </ErrorBoundary>, 
      dashboardController
    );

  } catch (err) {
    console.error('Failed to initialize dashboard:', err);
    showErrorState(err.message);
  }
});

// Error handler function
function showErrorState(message) {
  // Hide loading and app containers
  document.getElementById('dashboard-loading').style.display = 'none';
  document.getElementById('dashboard-app').style.display = 'none';
  
  // Show error container
  const errorContainer = document.getElementById('dashboard-error');
  errorContainer.style.display = 'block';
  
  // Add error message
  const errorMessage = errorContainer.querySelector('.error-message');
  errorMessage.textContent = message || 'An unknown error occurred while loading the dashboard.';
  
  // Add retry handler
  const retryButton = document.getElementById('retry-button');
  retryButton.addEventListener('click', () => {
    window.location.reload();
  });
}

// Check for Confluence specific environment and adjust behavior if needed
if (window.AP && window.AP.confluence) {
  console.log('Running in Confluence environment');
  // Example of integration with Confluence JavaScript API
  window.AP.confluence.getMacroData(function(data) {
    // You can use macro parameters if your macro supports them
    console.log('Macro data:', data);
  });
}