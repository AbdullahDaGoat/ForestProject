// lib/dangerLevels.ts

export type DangerLevel =
  | 'extreme'
  | 'very high'
  | 'high'
  | 'medium'
  | 'low'
  | 'normal'
  | 'no risk';

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

// Adjusted thresholds
const TEMP_THRESHOLDS = {
  extreme: 60,    // 60°C and above
  veryHigh: 45,   // 45-59°C
  high: 35,       // 35-44°C
  medium: 25,     // 25-34°C
  low: 15,        // 15-24°C
  normal: 5,      // 5-14°C
  // Below 5 => 'no risk' for heat
};

// Example AQI thresholds (tweak as needed)
const AQI_THRESHOLDS = {
  extreme: 300,   // Hazardous
  veryHigh: 200,  // Very Unhealthy
  high: 150,      // Unhealthy
  medium: 100,    // Unhealthy for Sensitive Groups
  low: 50,        // Moderate
  normal: 0,      // Good
};

export function assessDangerLevel(data: EnvironmentalData): DangerAssessment {
  let tempLevel: DangerLevel = 'no risk';
  let aqiLevel: DangerLevel = 'no risk';
  
  // Assess temperature
  if (data.temperature >= TEMP_THRESHOLDS.extreme) {
    tempLevel = 'extreme';
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
    if (data.airQuality >= AQI_THRESHOLDS.extreme) {
      aqiLevel = 'extreme';
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
  
  // Overall danger level: take the "higher" of temperature vs. airQuality
  const dangerLevels: DangerLevel[] = [
    'no risk',
    'normal',
    'low',
    'medium',
    'high',
    'very high',
    'extreme'
  ];
  const overallLevel = dangerLevels[
    Math.max(dangerLevels.indexOf(tempLevel), dangerLevels.indexOf(aqiLevel))
  ];

  // Build a descriptive string
  let description = '';
  if (tempLevel !== 'no risk' && tempLevel !== 'normal' && tempLevel !== 'low') {
    description += `High temperature detected (${data.temperature}°C). `;
  }
  if (aqiLevel !== 'no risk' && aqiLevel !== 'normal' && aqiLevel !== 'low' && data.airQuality !== undefined) {
    description += `Poor air quality (AQI: ${data.airQuality}). `;
  }
  if (!description) {
    description = 'No significant environmental concerns detected.';
  }
  
  return {
    level: overallLevel,
    description
  };
}
