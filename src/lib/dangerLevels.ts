/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { calculateDistance } from './utils';

/* =========================================
   PART 1) TYPE DEFINITIONS & LEGACY LOGIC
   ========================================= */

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
  windSpeed?: number;    // e.g., in km/h or m/s
  humidity?: number;     // e.g., in % (0–100)
  drynessIndex?: number; // a domain-specific dryness measure, 0–100, with 100 = extreme dryness
  timeOfDay?: number;    // optional 0–23, local hour if we want time-based weighting
  location: {
    lat: number;
    lng: number;
  };
}

export interface DangerAssessment {
  level: DangerLevel;
  description: string;
}

/**
 * Fallback function if location data is missing or we don’t want advanced logic.
 */
export function assessDangerLevel(data: EnvironmentalData): DangerAssessment {
  // Basic threshold approach: temperature + AQI
  const TEMP_THRESHOLDS = {
    extreme: 60,
    veryHigh: 45,
    high: 35,
    medium: 25,
    low: 15,
    normal: 5,
  };

  const AQI_THRESHOLDS = {
    extreme: 300,
    veryHigh: 200,
    high: 150,
    medium: 100,
    low: 50,
    normal: 0,
  };

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

  // Evaluate air quality
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

  // Take max
  const dangerLevels: DangerLevel[] = [
    'no risk',
    'normal',
    'low',
    'medium',
    'high',
    'very high',
    'extreme',
  ];

  const overallLevel: DangerLevel = dangerLevels[
    Math.max(dangerLevels.indexOf(tempLevel), dangerLevels.indexOf(aqiLevel))
  ];

  let description = '';
  if (overallLevel !== 'no risk') {
    description = `Temperature classification: ${tempLevel}. AQI classification: ${aqiLevel}.`;
  } else {
    description = 'No significant environmental concerns detected.';
  }

  return {
    level: overallLevel,
    description,
  };
}

/* =========================================
   PART 2) DATA UNIFICATION
   ========================================= */

// We want all records to end up in this shape:
interface HistoricalFireRecord {
  fire_id: string;
  date: string;       // "YYYY-MM-DD" format
  cause: string;      // "Lightning", "Human", etc.
  area_burned: number;
  severity: string;   // "extreme", "high", "medium", etc.
  location: {
    latitude: number;
    longitude: number;
  };
  // You can keep extra fields like incident_name if you like
  incident_name?: string | null;
}

const historicalData: HistoricalFireRecord[] = [];

/**
 * Unify a raw JSON record from *either* wildfire_data.json *or* wildfire_data_1.json / _2.json
 * into our stable HistoricalFireRecord structure.
 * Returns null if location is invalid or data can't be parsed.
 */
function unifyRecord(raw: any): HistoricalFireRecord | null {
  // 1) Build date string. If the data has "Year" => second format,
  //    otherwise we assume the first format's "date".
  let dateStr: string | null = null;

  const hasYear = raw.Year !== undefined && raw.Month !== undefined;
  if (hasYear) {
    // second format
    const y = parseInt(raw.Year, 10);
    const m = parseInt(raw.Month, 10);
    const d = parseInt(raw.Day, 10);
    // fallback to 1 if 0 or missing
    const safeMonth = m >= 1 && m <= 12 ? m : 1;
    const safeDay = d >= 1 && d <= 31 ? d : 1;
    // build "YYYY-MM-DD"
    dateStr = `${String(y).padStart(4, '0')}-${String(safeMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  } else {
    // first format's raw.date
    if (raw.date && typeof raw.date === 'string') {
      dateStr = raw.date; // e.g. "2023-03-27"
    } else {
      dateStr = null; // no date => fallback
    }
  }

  // if dateStr is still null => fallback to "1970-01-01"
  if (!dateStr) {
    dateStr = '1970-01-01';
  }

  // 2) unify cause
  const cause = unifyCause(raw.cause);

  // 3) unify severity
  const severity = unifySeverity(raw.severity);

  // 4) unify area_burned
  let area = 0;
  if (typeof raw.area_burned === 'number' && !isNaN(raw.area_burned)) {
    area = raw.area_burned;
  }

  // 5) unify location
  // must have .location.latitude and .location.longitude
  if (!raw.location || typeof raw.location.latitude !== 'number' || typeof raw.location.longitude !== 'number') {
    return null; // skip if no location
  }

  // 6) unify fire_id
  const fireId = raw.fire_id ? String(raw.fire_id) : 'unknown-id';

  // 7) unify incident_name if it exists
  let incident = null;
  if (raw.incident_name !== undefined && typeof raw.incident_name === 'string') {
    incident = raw.incident_name;
  }

  // 8) build the final object
  const record: HistoricalFireRecord = {
    fire_id: fireId,
    date: dateStr,
    cause,
    area_burned: area,
    severity,
    location: {
      latitude: raw.location.latitude,
      longitude: raw.location.longitude,
    },
    incident_name: incident,
  };

  return record;
}

/**
 * Convert cause codes like "LTG" => "Lightning", "MAN" => "Human", "Person" => "Human", etc.
 */
function unifyCause(causeVal: any): string {
  if (!causeVal || typeof causeVal !== 'string') return 'Unknown';
  const c = causeVal.trim().toUpperCase();
  if (c === 'LTG') return 'Lightning';
  if (c === 'MAN' || c === 'PERSON') return 'Human';
  // add more if needed
  return c; // fallback
}

/**
 * Convert different severity strings to a uniform set, e.g. "very low" => "low", etc.
 */
function unifySeverity(sevVal: any): string {
  if (!sevVal || typeof sevVal !== 'string') return 'low';
  const s = sevVal.trim().toLowerCase();
  if (s.includes('very low')) return 'low';
  if (s.includes('extreme')) return 'extreme';
  if (s.includes('very high')) return 'very high'; // depends on your usage
  return s;
}

/**
 * loadHistoricalWildfireData: merges data from multiple files, normalizing them via unifyRecord.
 */
export function loadHistoricalWildfireData(): void {
  if (historicalData.length > 0) {
    return; // already loaded
  }

  const files = [
    'wildfire_data_1_part1.json', // second format (Year, Month, Day)
    'wildfire_data_1_part2.json',
    'wildfire_data_part1.json',
    'wildfire_data_part2.json',
    'wildfire_data_2.json', // second format as well
    // add more if needed
  ];

  for (const file of files) {
    const filePath = path.join(process.cwd(), 'lib', file);
    let rawArray: any[] = [];
    try {
      const contents = fs.readFileSync(filePath, 'utf-8');
      rawArray = JSON.parse(contents);
    } catch (err) {
      console.error(`Failed to load ${file}:`, err);
      continue;
    }

    for (const raw of rawArray) {
      const rec = unifyRecord(raw);
      if (rec) {
        historicalData.push(rec);
      }
    }
  }

  console.log(`Loaded ${historicalData.length} total unified wildfire records.`);
}

/* =========================================
   PART 3) ADVANCED SCORING LOGIC
   ========================================= */

/**
 * Weighted recency factor. E.g.:
 *  - <=2 years => 1.0
 *  - <=5 years => 0.8
 *  - <=10 years => 0.5
 *  - >10 years => 0.2
 */
function getRecencyFactor(dateStr: string): number {
  const now = new Date();
  const fireDate = new Date(dateStr);

  const msInYear = 1000 * 3600 * 24 * 365;
  const yearsAgo = (now.getTime() - fireDate.getTime()) / msInYear;

  if (yearsAgo <= 2) return 1.0;
  if (yearsAgo <= 5) return 0.8;
  if (yearsAgo <= 10) return 0.5;
  return 0.2;
}

/**
 * Simple cause-based weighting:
 *   "LIGHTNING" => 1.2
 *   "HUMAN" => 1.1
 *   else => 1.0
 */
function getCauseFactor(cause: string): number {
  const c = cause.toLowerCase();
  if (c === 'lightning') return 1.2;
  if (c === 'human') return 1.1;
  return 1.0;
}

/**
 * Seasonality check. 
 * If same month => 1.15
 * If also typical fire season (May–Sep => months 4..8) => multiply by 1.10 more.
 */
function getSeasonalityFactor(fireDateStr: string): number {
  const now = new Date();
  const fireDate = new Date(fireDateStr);

  const currentMonth = now.getMonth(); // 0..11
  const fireMonth = fireDate.getMonth(); // 0..11

  let factor = fireMonth === currentMonth ? 1.15 : 1.0;

  const isFireSeason = (m: number) => m >= 4 && m <= 8;
  if (isFireSeason(fireMonth)) {
    factor *= 1.1;
  }
  return factor;
}

/**
 * Distance weighting. If dist=0 => factor=1, if dist near radius => factor near 0.
 */
function getDistanceWeight(distKm: number, maxRadius: number): number {
  const remainder = maxRadius - distKm;
  if (remainder <= 0) return 0;
  return remainder / maxRadius;
}

/**
 * Consecutive-year logic. 
 * Collect consecutive runs, apply penalty based on their length.
 */
function getConsecutiveYearPenalty(fires: HistoricalFireRecord[]): number {
  if (fires.length < 2) return 0;

  const years = fires.map((f) => new Date(f.date).getFullYear()).sort((a, b) => a - b);

  let totalPenalty = 0;
  let consecutiveCount = 1;
  for (let i = 0; i < years.length - 1; i++) {
    if (years[i + 1] === years[i] + 1) {
      consecutiveCount++;
    } else {
      if (consecutiveCount >= 2) {
        totalPenalty += getPenaltyByConsecutiveCount(consecutiveCount);
      }
      consecutiveCount = 1;
    }
  }
  if (consecutiveCount >= 2) {
    totalPenalty += getPenaltyByConsecutiveCount(consecutiveCount);
  }
  return totalPenalty;
}

function getPenaltyByConsecutiveCount(count: number): number {
  if (count === 2) return 0.2;
  if (count === 3) return 0.5;
  if (count === 4) return 0.8;
  return 1.0; // 5+
}

/**
 * Overlapping fires penalty: if multiple fires in the same year => small penalty
 */
function getOverlappingFiresPenalty(fires: HistoricalFireRecord[]): number {
  const yearCounts: Record<number, number> = {};
  for (const f of fires) {
    const y = new Date(f.date).getFullYear();
    yearCounts[y] = (yearCounts[y] || 0) + 1;
  }

  let penalty = 0;
  for (const yStr of Object.keys(yearCounts)) {
    const count = yearCounts[+yStr];
    if (count > 1) {
      // each extra overlapping fire => +0.1
      penalty += (count - 1) * 0.1;
    }
  }
  return penalty;
}

/* =========================================
   PART 4) MASTER SCORING FUNCTION
   ========================================= */

function computeRiskFromHistoryAndRealTime(
  env: EnvironmentalData,
  nearestFires: HistoricalFireRecord[],
  relevantRadius: number
): { riskLevel: string; riskExplanation: string } {

  if (!nearestFires.length) {
    return {
      riskLevel: 'Low',
      riskExplanation: 'No historical fires found. Using real-time only.',
    };
  }

  let historicalScore = 0;
  for (const fire of nearestFires) {
    // severity
    let sevValue = 0;
    const s = fire.severity.toLowerCase();
    if (s.includes('extreme') || s.includes('very high')) {
      sevValue = 3;
    } else if (s.includes('high')) {
      sevValue = 2;
    } else if (s.includes('medium')) {
      sevValue = 1;
    }

    const areaFactor = fire.area_burned > 500 ? 1.5 : 1.0;
    const recencyFactor = getRecencyFactor(fire.date);
    const seasonalityFactor = getSeasonalityFactor(fire.date);
    const causeFactor = getCauseFactor(fire.cause);

    const dist = calculateDistance(
      env.location.lat,
      env.location.lng,
      fire.location.latitude,
      fire.location.longitude
    );
    const distanceFactor = getDistanceWeight(dist, relevantRadius);

    const fireScore =
      sevValue *
      areaFactor *
      recencyFactor *
      seasonalityFactor *
      causeFactor *
      distanceFactor;

    historicalScore += fireScore;
  }

  const frequencyScore = Math.min(nearestFires.length, 5);
  const consecutivePenalty = getConsecutiveYearPenalty(nearestFires);
  const overlapPenalty = getOverlappingFiresPenalty(nearestFires);

  // Real-time scoring
  let realTimeScore = 0;

  // Temperature
  if (env.temperature >= 45) realTimeScore += 3;
  else if (env.temperature >= 35) realTimeScore += 2;
  else if (env.temperature >= 25) realTimeScore += 1;

  // AQI
  if (env.airQuality !== undefined) {
    if (env.airQuality >= 200) realTimeScore += 2;
    else if (env.airQuality >= 150) realTimeScore += 1.5;
    else if (env.airQuality >= 100) realTimeScore += 1;
  }

  // drynessIndex
  if (env.drynessIndex !== undefined) {
    if (env.drynessIndex >= 80) realTimeScore += 2;
    else if (env.drynessIndex >= 60) realTimeScore += 1;
  }

  // humidity
  if (env.humidity !== undefined && env.humidity < 20) {
    realTimeScore += 1;
  }

  // windSpeed
  if (env.windSpeed !== undefined && env.windSpeed > 40) {
    realTimeScore += 1;
  }

  // timeOfDay
  if (env.timeOfDay !== undefined) {
    if (env.timeOfDay >= 13 && env.timeOfDay <= 17) {
      realTimeScore += 0.5;
    }
  }

  const totalScore =
    historicalScore +
    frequencyScore +
    consecutivePenalty +
    overlapPenalty +
    realTimeScore;

  // Map final numeric score to risk categories
  let riskLevel = 'Low';
  if (totalScore >= 35) {
    riskLevel = 'Extreme';
  } else if (totalScore >= 20) {
    riskLevel = 'Very High';
  } else if (totalScore >= 12) {
    riskLevel = 'High';
  } else if (totalScore >= 6) {
    riskLevel = 'Medium';
  } else if (totalScore >= 2) {
    riskLevel = 'Low';
  } else {
    riskLevel = 'no risk';
  }

  const riskExplanation = `
    Historical Score: ${historicalScore.toFixed(2)},
    Frequency: ${frequencyScore.toFixed(2)},
    ConsecutivePenalty: ${consecutivePenalty.toFixed(2)},
    OverlapPenalty: ${overlapPenalty.toFixed(2)},
    RealTime: ${realTimeScore.toFixed(2)},
    Total => ${totalScore.toFixed(2)}
  `;

  return { riskLevel, riskExplanation };
}

/* =========================================
   PART 5) MAIN getWildfireRisk ENTRY POINT
   ========================================= */

export function getWildfireRisk(env: EnvironmentalData): {
  riskLevel: string;
  riskExplanation: string;
} {
  loadHistoricalWildfireData();

  const relevantRadius = 50; // 50 km, for example
  const candidateFires = historicalData.filter((fire) => {
    const dist = calculateDistance(
      env.location.lat,
      env.location.lng,
      fire.location.latitude,
      fire.location.longitude
    );
    return dist <= relevantRadius;
  });

  // optionally sort by distance & pick top 15
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

  const nearestFires = candidateFires.slice(0, 15);

  const { riskLevel, riskExplanation } = computeRiskFromHistoryAndRealTime(
    env,
    nearestFires,
    relevantRadius
  );

  if (!nearestFires.length) {
    return { riskLevel, riskExplanation };
  }

  return {
    riskLevel,
    riskExplanation: `Found ${nearestFires.length} fires within ${relevantRadius} km. ${riskExplanation}`,
  };
}
