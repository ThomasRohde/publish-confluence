/**
 * SummaryMetrics component displays key metrics in a grid layout
 * This demonstrates how to display summary data in a Confluence-friendly way
 */
export function SummaryMetrics({ data, loading }) {
  // Format large numbers for display
  const formatNumber = (num) => {
    if (num === undefined || num === null) return '-';
    return new Intl.NumberFormat().format(num);
  };

  // Show loading state if needed
  if (loading && !data) {
    return (
      <div className="chart-container" id="summary-metrics">
        <div className="chart-header">
          <h3 className="chart-title">Key Metrics</h3>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // Default/empty data if none provided
  const metrics = data || {
    total: 0,
    average: 0,
    max: 0,
    min: 0,
    count: 0
  };

  return (
    <div className="chart-container" id="summary-metrics">
      <div className="chart-header">
        <h3 className="chart-title">Key Metrics</h3>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        <div className="metric-card">
          <div className="metric-title">Total Value</div>
          <div className="metric-value">{formatNumber(metrics.total)}</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-title">Average</div>
          <div className="metric-value">{formatNumber(metrics.average)}</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-title">Maximum</div>
          <div className="metric-value">{formatNumber(metrics.max)}</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-title">Entries</div>
          <div className="metric-value">{formatNumber(metrics.count)}</div>
        </div>
      </div>
    </div>
  );
}