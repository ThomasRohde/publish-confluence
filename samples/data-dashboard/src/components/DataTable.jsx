import { useState } from 'preact/hooks';

/**
 * DataTable component displays tabular data with pagination
 * This demonstrates how to display detailed information in a Confluence-friendly way
 */
export function DataTable({ data, loading }) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('asc');
  const itemsPerPage = 5;

  // Handle sorting changes
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Format data for display
  const formatValue = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  // Format date more attractively
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    }).format(date);
  };

  // If no data is provided, return a placeholder or loading state
  if (!data || data.length === 0) {
    return (
      <div className="chart-container" id="data-table">
        <div className="chart-header">
          <h3 className="chart-title">Detailed Data</h3>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          {loading ? (
            <div className="loading-spinner"></div>
          ) : (
            'No data available'
          )}
        </div>
      </div>
    );
  }

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    let valueA = a[sortColumn];
    let valueB = b[sortColumn];
    
    if (typeof valueA === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }
    
    if (valueA < valueB) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (valueA > valueB) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle page changes
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Generate pagination controls
  const renderPagination = () => {
    const pages = [];
    const showEllipsis = totalPages > 7;
    
    let startPage = 1;
    let endPage = totalPages;
    
    if (showEllipsis) {
      if (currentPage <= 4) {
        endPage = 5;
      } else if (currentPage >= totalPages - 3) {
        startPage = totalPages - 4;
      } else {
        startPage = currentPage - 2;
        endPage = currentPage + 2;
      }
    }
    
    // Previous button
    pages.push(
      <button 
        key="prev" 
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="dashboard-button dashboard-button-sm dashboard-button-secondary"
        style={{ marginRight: '4px' }}
      >
        &lt;
      </button>
    );
    
    // First page & ellipsis
    if (showEllipsis && startPage > 1) {
      pages.push(
        <button 
          key="page-1" 
          onClick={() => goToPage(1)}
          className={`dashboard-button dashboard-button-sm ${currentPage === 1 ? 'dashboard-button-primary' : 'dashboard-button-secondary'}`}
          style={{ marginRight: '4px' }}
        >
          1
        </button>
      );
      
      if (startPage > 2) {
        pages.push(<span key="ellipsis1" style={{ margin: '0 8px' }}>...</span>);
      }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button 
          key={`page-${i}`} 
          onClick={() => goToPage(i)}
          className={`dashboard-button dashboard-button-sm ${currentPage === i ? 'dashboard-button-primary' : 'dashboard-button-secondary'}`}
          style={{ marginRight: '4px' }}
        >
          {i}
        </button>
      );
    }
    
    // Last page & ellipsis
    if (showEllipsis && endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(<span key="ellipsis2" style={{ margin: '0 8px' }}>...</span>);
      }
      
      pages.push(
        <button 
          key={`page-${totalPages}`} 
          onClick={() => goToPage(totalPages)}
          className={`dashboard-button dashboard-button-sm ${currentPage === totalPages ? 'dashboard-button-primary' : 'dashboard-button-secondary'}`}
          style={{ marginRight: '4px' }}
        >
          {totalPages}
        </button>
      );
    }
    
    // Next button
    pages.push(
      <button 
        key="next" 
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="dashboard-button dashboard-button-sm dashboard-button-secondary"
      >
        &gt;
      </button>
    );
    
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
        {pages}
      </div>
    );
  };

  // Generate sort indicator
  const getSortIndicator = (column) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="chart-container" id="data-table">
      <div className="chart-header">
        <h3 className="chart-title">Detailed Data</h3>
        <div className="chart-actions">
          <span>
            Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, data.length)} of {data.length}
          </span>
        </div>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
                Date {getSortIndicator('date')}
              </th>
              <th onClick={() => handleSort('region')} style={{ cursor: 'pointer' }}>
                Region {getSortIndicator('region')}
              </th>
              <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>
                Category {getSortIndicator('category')}
              </th>
              <th onClick={() => handleSort('value')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                Value {getSortIndicator('value')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, index) => (
              <tr key={index}>
                <td>{formatDate(item.date)}</td>
                <td>{item.region}</td>
                <td>{item.category}</td>
                <td style={{ textAlign: 'right' }}>{formatValue(item.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && renderPagination()}
    </div>
  );
}