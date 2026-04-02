// Mock historical data for Claude usage patterns
export interface UsageDataPoint {
  hour: number;
  usage: number;
  isPeak: boolean;
}

export interface DailyPattern {
  day: string;
  data: UsageDataPoint[];
}

// Generate realistic usage patterns based on typical developer activity
export function generateUsageData(): DailyPattern[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const patterns: DailyPattern[] = days.map(day => {
    const data: UsageDataPoint[] = [];
    
    for (let hour = 0; hour < 24; hour++) {
      let usage = 0;
      
      // Weekend pattern (lighter usage)
      if (day === 'Saturday' || day === 'Sunday') {
        if (hour >= 10 && hour <= 22) {
          usage = 30 + Math.random() * 40;
        } else {
          usage = 5 + Math.random() * 15;
        }
      } else {
        // Weekday pattern (heavier during work hours)
        if (hour >= 9 && hour <= 17) {
          // Peak work hours
          usage = 70 + Math.random() * 30;
        } else if (hour >= 18 && hour <= 23) {
          // Evening hours
          usage = 40 + Math.random() * 30;
        } else if (hour >= 6 && hour <= 8) {
          // Early morning
          usage = 30 + Math.random() * 20;
        } else {
          // Night hours
          usage = 5 + Math.random() * 15;
        }
      }
      
      const isPeak = usage > 60;
      
      data.push({
        hour,
        usage: Math.round(usage),
        isPeak,
      });
    }
    
    return { day, data };
  });
  
  return patterns;
}

export function getCurrentDayData(): UsageDataPoint[] {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const allData = generateUsageData();
  const todayData = allData.find(d => d.day === today);
  return todayData?.data || allData[0].data;
}

export function predictNextPromotion(): { hour: number; day: string; reason: string } {
  const allData = generateUsageData();
  const currentHour = new Date().getHours();
  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  
  // Find the next off-peak period (usage < 40) that's at least 2 hours away
  let searchDay = currentDay;
  let searchHour = currentHour + 2;
  
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dayIndex = (new Date().getDay() + dayOffset) % 7;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    searchDay = dayNames[dayIndex];
    
    const dayData = allData.find(d => d.day === searchDay);
    if (!dayData) continue;
    
    const startHour = dayOffset === 0 ? searchHour : 0;
    
    for (let hour = startHour; hour < 24; hour++) {
      const dataPoint = dayData.data[hour];
      if (dataPoint.usage < 40) {
        // Found an off-peak period
        let reason = '';
        if (hour >= 0 && hour < 6) {
          reason = 'Late night - lowest usage period';
        } else if (hour >= 6 && hour < 9) {
          reason = 'Early morning - pre-work hours';
        } else if (hour >= 12 && hour < 14) {
          reason = 'Lunch time - reduced activity';
        } else {
          reason = 'Off-peak period detected';
        }
        
        return { hour, day: searchDay, reason };
      }
    }
  }
  
  // Fallback: suggest 2 AM
  return { 
    hour: 2, 
    day: currentDay, 
    reason: 'Default low-traffic period' 
  };
}
