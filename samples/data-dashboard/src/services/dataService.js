/**
 * Data service for fetching and manipulating dashboard data
 * In a real application, this would make API calls to your backend
 */

import { addDays, differenceInDays, format } from 'date-fns';

// Simulate network latency for demo purposes
const simulateNetworkDelay = () => new Promise(resolve => setTimeout(resolve, 800));

/**
 * Generate random sample data for the dashboard demo
 * @param {Object} dateRange - Start and end dates
 * @param {Object} filters - Region and category filters
 */
export async function fetchDashboardData(dateRange, filters) {
  // Simulate API call delay
  await simulateNetworkDelay();

  // Generate dates between start and end dates
  const days = differenceInDays(dateRange.end, dateRange.start);
  const dates = Array.from({ length: days + 1 }, (_, i) => 
    format(addDays(dateRange.start, i), 'yyyy-MM-dd')
  );

  // Generate regions and categories for our data
  const regions = ['North America', 'Europe', 'Asia', 'Latin America', 'Africa'];
  const categories = ['Products', 'Services', 'Support', 'Marketing'];
  
  // Apply filters
  const filteredRegions = filters.region === 'all' ? regions : [filters.region];
  const filteredCategories = filters.category === 'all' ? categories : [filters.category];

  // Generate detailed data records
  const details = [];
  for (const date of dates) {
    for (const region of filteredRegions) {
      for (const category of filteredCategories) {
        // Base value with some randomness
        const baseValue = Math.floor(Math.random() * 1000);
        
        // Regional variance
        let regionMultiplier = 1.0;
        if (region === 'North America') regionMultiplier = 1.5;
        if (region === 'Europe') regionMultiplier = 1.3;
        if (region === 'Asia') regionMultiplier = 1.4;
        if (region === 'Latin America') regionMultiplier = 0.8;
        if (region === 'Africa') regionMultiplier = 0.7;
        
        // Category variance
        let categoryMultiplier = 1.0;
        if (category === 'Products') categoryMultiplier = 1.4;
        if (category === 'Services') categoryMultiplier = 1.2;
        if (category === 'Support') categoryMultiplier = 0.7;
        if (category === 'Marketing') categoryMultiplier = 0.9;
        
        // Calculate final value with some randomness
        const value = Math.floor(
          baseValue * regionMultiplier * categoryMultiplier * (0.9 + Math.random() * 0.2)
        );
        
        details.push({
          date,
          region,
          category,
          value
        });
      }
    }
  }

  // Calculate summary metrics
  const totalValue = details.reduce((sum, item) => sum + item.value, 0);
  const averageValue = Math.round(totalValue / details.length);
  const maxValue = Math.max(...details.map(item => item.value));
  const minValue = Math.min(...details.map(item => item.value));
  
  // Calculate trends (daily totals)
  const trend = dates.map(date => {
    const dayItems = details.filter(item => item.date === date);
    const dailyTotal = dayItems.reduce((sum, item) => sum + item.value, 0);
    return { date, value: dailyTotal };
  });
  
  // Calculate distribution by category and region
  const byCategory = {};
  const byRegion = {};
  
  for (const item of details) {
    // Sum by category
    byCategory[item.category] = (byCategory[item.category] || 0) + item.value;
    
    // Sum by region
    byRegion[item.region] = (byRegion[item.region] || 0) + item.value;
  }
  
  // Format for chart libraries
  const distribution = {
    byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
    byRegion: Object.entries(byRegion).map(([name, value]) => ({ name, value }))
  };
  
  // Return formatted dashboard data
  return {
    summary: {
      total: totalValue,
      average: averageValue,
      max: maxValue,
      min: minValue,
      count: details.length
    },
    trend,
    distribution,
    details: details.sort((a, b) => new Date(a.date) - new Date(b.date))
  };
}