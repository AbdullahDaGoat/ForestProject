import fs from 'fs';
import path from 'path';
import { calculateDistance } from './utils';

/* ------------------------------------
 * 1) LEGACY DangerLevel & Temperature-based logic
 * ------------------------------------ */

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
    windSpeed?: number;  // <--- Add this
    humidity?: number;   // <--- And this
    location: {
      lat: number;
      lng: number;
    };
  }

export interface DangerAssessment {
  level: DangerLevel;
  description: string;
}

// Existing thresholds
const TEMP_THRESHOLDS = {
  extreme: 60, // 60°C and above
  veryHigh: 45, // 45-59°C
  high: 35, // 35-44°C
  medium: 25, // 25-34°C
  low: 15, // 15-24°C
  normal: 5, // 5-14°C
  // below 5 => 'no risk'
};

const AQI_THRESHOLDS = {
  extreme: 300, // Hazardous
  veryHigh: 200, // Very Unhealthy
  high: 150, // Unhealthy
  medium: 100, // Unhealthy for Sensitive Groups
  low: 50, // Moderate
  normal: 0, // Good
};

/**
 * Original fallback method:
 * Purely uses temperature + AQI thresholds
 */
export function assessDangerLevel(data: EnvironmentalData): DangerAssessment {
  let tempLevel: DangerLevel = 'no risk';
  let aqiLevel: DangerLevel = 'no risk';

  // Evaluate temperature
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

  // Evaluate air quality if provided
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

  // Combine temperature & AQI
  const dangerLevels: DangerLevel[] = [
    'no risk',
    'normal',
    'low',
    'medium',
    'high',
    'very high',
    'extreme',
  ];
  const overallLevel =
    dangerLevels[
      Math.max(dangerLevels.indexOf(tempLevel), dangerLevels.indexOf(aqiLevel))
    ];

  // Build description
  let description = '';
  if (tempLevel !== 'no risk' && tempLevel !== 'normal' && tempLevel !== 'low') {
    description += `High temperature detected (${data.temperature}°C). `;
  }
  if (
    aqiLevel !== 'no risk' &&
    aqiLevel !== 'normal' &&
    aqiLevel !== 'low' &&
    data.airQuality !== undefined
  ) {
    description += `Poor air quality (AQI: ${data.airQuality}). `;
  }
  if (!description) {
    description = 'No significant environmental concerns detected.';
  }

  return {
    level: overallLevel,
    description,
  };
}

/* ------------------------------------
 * 2) NEW Historical Wildfire Data Logic
 * ------------------------------------ */

interface HistoricalFireRecord {
  fire_id: string;
  date: string;
  cause: string;
  area_burned: number;
  severity: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

let historicalData: HistoricalFireRecord[] = [];

/**
 * Loads multiple wildfire JSON files from your /lib folder into memory once.
 */
export function loadHistoricalWildfireData(): void {
  if (historicalData.length > 0) return;

  const files = [
    'wildfire_data.json',
    'wildfire_data_1.json',
    'wildfire_data_2.json',
  ];

  for (const file of files) {
    try {
      const filePath = path.join(process.cwd(), 'lib', file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const records: HistoricalFireRecord[] = JSON.parse(fileContent);
      historicalData = historicalData.concat(records);
    } catch (err) {
      console.error(`Failed to load ${file}:`, err);
    }
  }
  console.log(`Loaded ${historicalData.length} total wildfire records.`);
}

/**
 * A simple scoring function that merges:
 * 1) Historical severity + area + frequency
 * 2) Real-time conditions (temperature, air quality, etc.)
 */
function computeRiskFromHistoryAndRealTime(
  env: EnvironmentalData,
  nearestFires: HistoricalFireRecord[]
): { riskLevel: string; riskExplanation: string } {
  if (!nearestFires.length) {
    return {
      riskLevel: 'Low',
      riskExplanation:
        'No major historical fires found near this location. Risk based solely on current conditions.',
    };
  }

  // Historical severity and frequency
  let historicalSeverityScore = 0;
  for (const fire of nearestFires) {
    let sevValue = 0;
    const s = fire.severity.toLowerCase();
    if (s.includes('extreme') || s.includes('very high')) sevValue = 3;
    else if (s.includes('high')) sevValue = 2;
    else if (s.includes('medium')) sevValue = 1;
    const areaFactor = fire.area_burned > 500 ? 1.5 : 1.0;
    historicalSeverityScore += sevValue * areaFactor;
  }

  const frequencyScore = Math.min(nearestFires.length, 5); // e.g. limit at 5

  // Real-time environment
  let realTimeScore = 0;
  // Example temperature weighting
  if (env.temperature >= 45) {
    realTimeScore += 3;
  } else if (env.temperature >= 35) {
    realTimeScore += 2;
  }

  if (env.airQuality !== undefined) {
    if (env.airQuality >= 200) {
      realTimeScore += 2;
    } else if (env.airQuality >= 150) {
      realTimeScore += 1.5;
    }
  }

  // Summation
  const totalScore = historicalSeverityScore + frequencyScore + realTimeScore;

  let riskLevel = 'Low';
  if (totalScore >= 20) riskLevel = 'Extreme';
  else if (totalScore >= 10) riskLevel = 'High';
  else if (totalScore >= 5) riskLevel = 'Medium';

  const riskExplanation = `Historical severity: ${historicalSeverityScore.toFixed(
    1
  )}, frequency: ${frequencyScore.toFixed(
    1
  )}, real-time: ${realTimeScore.toFixed(
    1
  )}. Combined => ${totalScore.toFixed(1)}`;

  return {
    riskLevel,
    riskExplanation,
  };
}

/**
 * getWildfireRisk: The main entry point for your updated location-based logic.
 */
export function getWildfireRisk(env: EnvironmentalData): {
  riskLevel: string;
  riskExplanation: string;
} {
  loadHistoricalWildfireData(); // ensure data is loaded

  // For example, filter nearest historical fires within 50 km
  const relevantRadius = 50;
  const candidateFires = historicalData.filter((fire) => {
    const dist = calculateDistance(
      env.location.lat,
      env.location.lng,
      fire.location.latitude,
      fire.location.longitude
    );
    return dist <= relevantRadius;
  });

  // Optionally sort by distance and take only the top 10 or so
  candidateFires.sort((a, b) => {
    const distA = calculateDistance(
      env.location.lat,
      env.location.lng,
      a.location.latitude,
      a.location.longitude
    );
    const distB = calculateDistance(
      env.location.lat,
      env.location.lng,
      b.location.latitude,
      b.location.longitude
    );
    return distA - distB;
  });
  const nearestFires = candidateFires.slice(0, 10);

  // Merge historical + real-time scoring
  const { riskLevel, riskExplanation } = computeRiskFromHistoryAndRealTime(
    env,
    nearestFires
  );

  if (!nearestFires.length) {
    return {
      riskLevel,
      riskExplanation,
    };
  }
  return {
    riskLevel,
    riskExplanation: `Found ${nearestFires.length} historical fires within ${relevantRadius} km. ${riskExplanation}`,
  };
}
