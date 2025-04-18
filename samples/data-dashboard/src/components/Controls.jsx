import { format } from 'date-fns';

/**
 * Controls component that provides filtering and date range selection
 */
export function Controls({ dateRange, filters, onDateRangeChange, onFilterChange, onExport }) {
  // Handle region filter change
  const handleRegionChange = (e) => {
    onFilterChange({ region: e.target.value });
  };

  // Handle category filter change
  const handleCategoryChange = (e) => {
    onFilterChange({ category: e.target.value });
  };

  // Handle date range changes
  const handleStartDateChange = (e) => {
    const newStart = new Date(e.target.value);
    onDateRangeChange({
      start: newStart,
      end: dateRange.end
    });
  };

  const handleEndDateChange = (e) => {
    const newEnd = new Date(e.target.value);
    onDateRangeChange({
      start: dateRange.start,
      end: newEnd
    });
  };

  // Handle export button click
  const handleExportClick = () => {
    onExport('csv');
  };

  // Format dates for input fields
  const formatDateForInput = (date) => {
    return format(date, 'yyyy-MM-dd');
  };

  return (
    <div id="controls-container">
      <div className="filter-group">
        <div>
          <span className="filter-label">Date Range:</span>
          <input
            type="date"
            className="dashboard-input"
            value={formatDateForInput(dateRange.start)}
            onChange={handleStartDateChange}
            aria-label="Start Date"
          />
          <span> to </span>
          <input
            type="date"
            className="dashboard-input"
            value={formatDateForInput(dateRange.end)}
            onChange={handleEndDateChange}
            aria-label="End Date"
          />
        </div>
      </div>

      <div className="filter-group">
        <div>
          <span className="filter-label">Region:</span>
          <select
            className="dashboard-select"
            value={filters.region}
            onChange={handleRegionChange}
            aria-label="Region Filter"
          >
            <option value="all">All Regions</option>
            <option value="North America">North America</option>
            <option value="Europe">Europe</option>
            <option value="Asia">Asia</option>
            <option value="Latin America">Latin America</option>
            <option value="Africa">Africa</option>
          </select>
        </div>

        <div>
          <span className="filter-label">Category:</span>
          <select
            className="dashboard-select"
            value={filters.category}
            onChange={handleCategoryChange}
            aria-label="Category Filter"
          >
            <option value="all">All Categories</option>
            <option value="Products">Products</option>
            <option value="Services">Services</option>
            <option value="Support">Support</option>
            <option value="Marketing">Marketing</option>
          </select>
        </div>
      </div>

      <div className="chart-actions">
        <button
          className="dashboard-button dashboard-button-secondary"
          onClick={handleExportClick}
          aria-label="Export Data"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}