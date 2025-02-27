export type DangerLevel = 'dangerous' | 'very high' | 'high' | 'medium' | 'low' | 'normal' | 'no risk';

export interface EnvironmentalData {
  temperature: number;
  airQuality?: number;
  location: {
    lat: number;
    lng: number;
  };
}

export interface DangerAssessment {
  level: DangerLevel;
  description: string;
}

// Temperature thresholds in Celsius for Canada
const TEMP_THRESHOLDS = {
  dangerous: 40, // Extremely hot for Canada
  veryHigh: 35,
  high: 30,
  medium: 25,
  low: 15,
  normal: 5,
  // Below 5 is considered cold but not dangerous for this application
};

// Air Quality Index thresholds (based on common AQI scales)
// Lower is better
const AQI_THRESHOLDS = {
  dangerous: 300, // Hazardous
  veryHigh: 200, // Very Unhealthy
  high: 150,     // Unhealthy
  medium: 100,   // Unhealthy for Sensitive Groups
  low: 50,       // Moderate
  normal: 0,     // Good
};

export function assessDangerLevel(data: EnvironmentalData): DangerAssessment {
  let tempLevel: DangerLevel = 'no risk';
  let aqiLevel: DangerLevel = 'no risk';
  
  // Assess temperature
  if (data.temperature >= TEMP_THRESHOLDS.dangerous) {
    tempLevel = 'dangerous';
  } else if (data.temperature >= TEMP_THRESHOLDS.veryHigh) {
    tempLevel = 'very high';
  } else if (data.temperature >= TEMP_THRESHOLDS.high) {
    tempLevel = 'high';
  } else if (data.temperature >= TEMP_THRESHOLDS.medium) {
    tempLevel = 'medium';
  } else if (data.temperature >= TEMP_THRESHOLDS.low) {
    tempLevel = 'low';
  } else if (data.temperature >= TEMP_THRESHOLDS.normal) {
    tempLevel = 'normal';
  }
  
  // Assess air quality if provided
  if (data.airQuality !== undefined) {
    if (data.airQuality >= AQI_THRESHOLDS.dangerous) {
      aqiLevel = 'dangerous';
    } else if (data.airQuality >= AQI_THRESHOLDS.veryHigh) {
      aqiLevel = 'very high';
    } else if (data.airQuality >= AQI_THRESHOLDS.high) {
      aqiLevel = 'high';
    } else if (data.airQuality >= AQI_THRESHOLDS.medium) {
      aqiLevel = 'medium';
    } else if (data.airQuality >= AQI_THRESHOLDS.low) {
      aqiLevel = 'low';
    } else {
      aqiLevel = 'normal';
    }
  }
  
  // Determine the overall danger level (take the higher of the two)
  const dangerLevels: DangerLevel[] = ['no risk', 'normal', 'low', 'medium', 'high', 'very high', 'dangerous'];
  const tempIndex = dangerLevels.indexOf(tempLevel);
  const aqiIndex = dangerLevels.indexOf(aqiLevel);
  
  const overallLevel = dangerLevels[Math.max(tempIndex, aqiIndex)];
  
  // Generate a description based on the assessment
  let description = '';
  
  if (tempIndex > 2) { // 'low' or higher
    description += `High temperature detected (${data.temperature}°C). `;
  }
  
  if (data.airQuality !== undefined && aqiIndex > 2) { // 'low' or higher
    description += `Poor air quality detected (AQI: ${data.airQuality}). `;
  }
  
  if (description === '') {
    description = 'No significant environmental concerns detected.';
  }
  
  return {
    level: overallLevel,
    description
  };
}