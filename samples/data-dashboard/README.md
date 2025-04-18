# Interactive Data Dashboard Sample

This sample project demonstrates advanced usage of publish-confluence for embedding complex interactive applications in Confluence pages.

## Overview

This dashboard demonstrates how to build and publish a data visualization application to Confluence with:

- Interactive charts and visualizations using Chart.js
- Advanced component architecture with Preact
- Optimized bundle size with dynamic imports
- Responsive design that works well in Confluence
- Error handling and graceful fallbacks
- Date range filtering and data export features
- Custom styling that respects Confluence's environment

## Features

- **Summary Metrics**: Key performance indicators presented in a clean grid layout
- **Trend Analysis**: Line chart showing data trends over time
- **Distribution Chart**: Interactive pie chart with category/region views
- **Data Table**: Paginated and sortable table with raw data
- **Controls**: Date range picker and filtering options
- **CSV Export**: Export data to CSV format

## Technical Details

This sample uses:

- **Preact**: Lightweight alternative to React (~3KB)
- **Chart.js**: Responsive charting library with dynamic imports
- **date-fns**: Modern date utility library
- **Vite**: Fast build tool with optimized output
- **CSS Variables**: For theme consistency and maintainability

## Using This Sample

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Publish to Confluence:
```bash
npm run publish
```

## Configuration

Edit `publish-confluence.json` to customize:

- Confluence space and page details
- Template paths
- Included/excluded file patterns

## Templates

This sample includes:

- **confluence-template.html**: The Confluence page template with explanations
- **macro-template.html**: The HTML macro template with dashboard layout

## Best Practices Demonstrated

1. **Performance Optimization**:
   - Dynamic imports for Chart.js to reduce initial load time
   - Efficient rendering with Preact's virtual DOM
   - Pagination for large datasets

2. **User Experience**:
   - Loading states for asynchronous operations
   - Error boundaries for graceful error handling
   - Responsive design for all screen sizes

3. **Code Organization**:
   - Component-based architecture
   - Separation of concerns
   - Service layer for data fetching

4. **Confluence Integration**:
   - Namespaced CSS to avoid conflicts
   - Styled to match Confluence design patterns
   - Optimized for the Confluence content area width

## Learn More

For more details on how to use publish-confluence, see the [main project README](../../README.md).

## License

MIT