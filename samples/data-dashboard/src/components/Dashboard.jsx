import { useEffect, useState } from 'preact/hooks';
import { fetchDashboardData } from '../services/dataService';

/**
 * Main Dashboard component that orchestrates the entire dashboard experience
 * Modified to work with predefined containers in Confluence HTML macro
 */
export function Dashboard({
  renderControls,
  renderSummaryMetrics,
  renderTrendChart,
  renderDistributionChart,
  renderDataTable
}) {
  // State management
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({ 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
    end: new Date()
  });
  const [filters, setFilters] = useState({
    region: 'all',
    category: 'all'
  });

  // Fetch data on component mount and when filters/date range change
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        // Simulate network request delay
        const dashboardData = await fetchDashboardData(dateRange, filters);
        setData(dashboardData);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [dateRange.start, dateRange.end, filters.region, filters.category]);

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setFilters({ ...filters, ...newFilters });
  };

  // Handle date range changes
  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
  };

  // Handle data export
  const handleExport = (format) => {
    if (!data) return;
    
    // Sample implementation of CSV export
    if (format === 'csv') {
      const headers = ['date', 'value', 'category', 'region'];
      const csvContent = [
        headers.join(','),
        ...data.details.map(row => 
          [row.date, row.value, row.category, row.region].join(',')
        )
      ].join('\\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Show error state if needed, but use error container defined in macro template
  useEffect(() => {
    if (error) {
      const dashboardApp = document.getElementById('dashboard-app');
      const errorContainer = document.getElementById('dashboard-error');
      const errorMessage = errorContainer?.querySelector('.error-message');
      
      if (dashboardApp) dashboardApp.style.display = 'none';
      if (errorContainer) {
        errorContainer.style.display = 'block';
        if (errorMessage) errorMessage.textContent = error;
      }
    }
  }, [error]);

  // Render each component into its predefined container
  useEffect(() => {
    if (!loading) {
      // Render controls
      if (renderControls) {
        renderControls({
          dateRange, 
          filters,
          onDateRangeChange: handleDateRangeChange,
          onFilterChange: handleFilterChange,
          onExport: handleExport
        });
      }

      // Render individual panels
      if (renderSummaryMetrics) {
        renderSummaryMetrics({ data: data?.summary, loading });
      }
      
      if (renderTrendChart) {
        renderTrendChart({ data: data?.trend, loading });
      }
      
      if (renderDistributionChart) {
        renderDistributionChart({ data: data?.distribution, loading });
      }
      
      if (renderDataTable) {
        renderDataTable({ data: data?.details, loading });
      }
    }
  }, [
    loading, data, 
    renderControls, renderSummaryMetrics, renderTrendChart, renderDistributionChart, renderDataTable
  ]);

  // The Dashboard component doesn't render anything directly anymore
  // It just orchestrates rendering of components into their containers
  return null;
}