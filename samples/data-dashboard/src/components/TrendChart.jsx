import { CategoryScale, Chart, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import { useEffect, useRef } from 'preact/hooks';

// Register required Chart.js components
Chart.register(LineController, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

/**
 * TrendChart component displays a time series visualization
 * This demonstrates how to integrate Chart.js with publish-confluence
 */
export function TrendChart({ data, loading }) {
  // Reference to the canvas element
  const chartRef = useRef(null);
  // Reference to the Chart.js instance
  const chartInstance = useRef(null);

  // Initialize and update chart when data changes
  useEffect(() => {
    // Skip if loading or no data available
    if (loading || !data || !chartRef.current) {
      return;
    }

    try {
      // Clean up any existing chart instance
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      // Prepare the data for Chart.js
      const chartData = {
        labels: data.map(item => item.date),
        datasets: [{
          label: 'Daily Total',
          data: data.map(item => item.value),
          borderColor: '#0052CC',
          backgroundColor: 'rgba(0, 82, 204, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      };
      
      // Create the chart
      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  label += new Intl.NumberFormat().format(context.raw);
                  return label;
                }
              }
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: value => new Intl.NumberFormat().format(value)
              }
            },
            x: {
              ticks: {
                maxRotation: 45,
                minRotation: 45
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'nearest'
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
  }, [data, loading]);

  return (
    <div className="chart-container" id="trend-chart">
      <div className="chart-header">
        <h3 className="chart-title">Trend Analysis</h3>
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