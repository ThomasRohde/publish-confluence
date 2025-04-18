import { ArcElement, Chart, Legend, PieController, Tooltip } from 'chart.js';
import { useEffect, useRef, useState } from 'preact/hooks';

// Register required components
Chart.register(PieController, ArcElement, Tooltip, Legend);

/**
 * DistributionChart component displays pie charts for distribution visualization
 * This demonstrates how to create interactive visualizations for Confluence
 */
export function DistributionChart({ data, loading }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [activeView, setActiveView] = useState('category'); // 'category' or 'region'

  // Switch between category and region views
  const handleViewChange = (view) => {
    setActiveView(view);
  };

  // Initialize and update chart when data or view changes
  useEffect(() => {
    // Skip if loading or no data available
    if (loading || !data || !chartRef.current) {
      return;
    }

    // Select the appropriate data set based on active view
    const chartData = activeView === 'category' ? data.byCategory : data.byRegion;
    
    try {
      // Clean up any existing chart instance
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      // Color palette for chart segments
      const colors = [
        '#0052CC', '#36B37E', '#FF5630', '#00B8D9', '#6554C0',
        '#FFAB00', '#FF7452', '#8777D9', '#6C8294', '#4C9AFF'
      ];
      
      // Prepare the data for Chart.js
      const pieData = {
        labels: chartData.map(item => item.name),
        datasets: [{
          data: chartData.map(item => item.value),
          backgroundColor: chartData.map((_, i) => colors[i % colors.length]),
          borderColor: '#ffffff',
          borderWidth: 1
        }]
      };
      
      // Create the chart
      chartInstance.current = new Chart(chartRef.current, {
        type: 'pie',
        data: pieData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                padding: 15
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = Math.round((value / total) * 100);
                  return `${label}: ${new Intl.NumberFormat().format(value)} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to create chart:', error);
    }

    // Cleanup function to destroy chart when component unmounts
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, loading, activeView]);

  return (
    <div className="chart-container" id="distribution-chart">
      <div className="chart-header">
        <h3 className="chart-title">Distribution Analysis</h3>
        <div className="chart-actions">
          <button 
            className={`dashboard-button dashboard-button-sm ${activeView === 'category' ? 'dashboard-button-primary' : 'dashboard-button-secondary'}`}
            onClick={() => handleViewChange('category')}
          >
            By Category
          </button>
          <button 
            className={`dashboard-button dashboard-button-sm ${activeView === 'region' ? 'dashboard-button-primary' : 'dashboard-button-secondary'}`}
            onClick={() => handleViewChange('region')}
          >
            By Region
          </button>
        </div>
      </div>
      
      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px' }}>
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <div style={{ height: '250px', width: '100%', position: 'relative' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      )}
    </div>
  );
}