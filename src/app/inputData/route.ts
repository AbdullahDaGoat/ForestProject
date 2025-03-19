/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import {
  getWildfireRisk,
  assessDangerLevel,
  EnvironmentalData,
  DangerAssessment
} from '@/lib/dangerLevels';
import { calculateDistance } from '@/lib/utils';

interface DangerZone {
  temperature: number;
  airQuality: number | string;
  windSpeed?: number | string;
  humidity?: number | string;
  location: { lat: number; lng: number };
  dangerLevel: string;
  dangerDescription: string;
  timestamp: string;
}

// Keep up to 50 in-memory danger zone records
let dangerZones: DangerZone[] = [];

// SSE subscription set
const subscribers = new Set<ReadableStreamController<Uint8Array>>();

/**
 * Build SSE data once, encode once
 */
function buildDangerZonesSSE() {
  const data = JSON.stringify({ dangerZones });
  return new TextEncoder().encode(`data: ${data}\n\n`);
}

/**
 * Notify all SSE subscribers
 */
function notifySubscribers() {
  const encodedData = buildDangerZonesSSE();
  for (const controller of subscribers) {
    controller.enqueue(encodedData);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // 1) Check SSE subscription
  if (url.searchParams.get('subscribe') === 'true') {
    const stream = new ReadableStream({
      start(controller) {
        // Immediately send existing data
        controller.enqueue(buildDangerZonesSSE());
        // Track this controller in our subscriber set
        subscribers.add(controller);

        // Remove on client disconnect
        request.signal.addEventListener('abort', () => {
          subscribers.delete(controller);
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // 2) Otherwise, handle normal GET with query params
  const Temperature = url.searchParams.get('Temperature');
  const AirQuality = url.searchParams.get('AirQuality');
  const LocationLat = url.searchParams.get('LocationLat');
  const LocationLong = url.searchParams.get('LocationLong');
  // Optional wind/humidity
  const WindSpeed = url.searchParams.get('WindSpeed');
  const Humidity = url.searchParams.get('Humidity');

  // If no temperature, just return our in-memory zones
  if (!Temperature) {
    return NextResponse.json({ dangerZones });
  }

  try {
    // 3) Parse environment inputs
    const envData: EnvironmentalData = {
      temperature: parseFloat(Temperature),
      airQuality: AirQuality ? parseFloat(AirQuality) : undefined,
      // Add optional windSpeed, humidity if provided
      windSpeed: WindSpeed ? parseFloat(WindSpeed) : undefined,
      humidity: Humidity ? parseFloat(Humidity) : undefined,
      location: {
        lat: LocationLat ? parseFloat(LocationLat) : 0,
        lng: LocationLong ? parseFloat(LocationLong) : 0,
      },
    };

    // 4) Decide which method to use:
    //    - If location is provided, do new location-based logic.
    //    - Otherwise, fallback to old threshold-based approach.
    let dangerLevelResult: DangerAssessment | undefined;

    const hasLocation =
      LocationLat !== null &&
      LocationLong !== null &&
      !isNaN(envData.location.lat) &&
      !isNaN(envData.location.lng);

    if (hasLocation) {
      // Prefer the new location-based approach
      const riskResult = getWildfireRisk(envData);
      dangerLevelResult = {
        level: riskResult.riskLevel as any, // or cast to DangerLevel if desired
        description: riskResult.riskExplanation,
      };
    } else {
      // Fallback to old approach
      dangerLevelResult = assessDangerLevel(envData);
    }

    if (!dangerLevelResult) {
      // If for some reason both fail, just return
      return NextResponse.json({ error: 'Unable to calculate danger level.' }, { status: 400 });
    }

    // 5) Construct a new or updated DangerZone
    const newRecord: DangerZone = {
      temperature: envData.temperature,
      airQuality:
        envData.airQuality !== undefined ? envData.airQuality : 'N/A',
      windSpeed: envData.windSpeed !== undefined ? envData.windSpeed : 'N/A',
      humidity: envData.humidity !== undefined ? envData.humidity : 'N/A',
      location: {
        lat: envData.location.lat,
        lng: envData.location.lng,
      },
      dangerLevel: dangerLevelResult.level,
      dangerDescription: dangerLevelResult.description,
      timestamp: new Date().toISOString(),
    };

    // 6) See if an existing zone is within 5 km
    const existingIndex = dangerZones.findIndex((zone) => {
      const dist = calculateDistance(
        zone.location.lat,
        zone.location.lng,
        newRecord.location.lat,
        newRecord.location.lng
      );
      return dist < 5;
    });

    // 7) Update if found; otherwise insert as a new record
    if (existingIndex !== -1) {
      const updatedZone: DangerZone = {
        ...dangerZones[existingIndex],
        temperature: newRecord.temperature,
        airQuality: newRecord.airQuality,
        windSpeed: newRecord.windSpeed,
        humidity: newRecord.humidity,
        dangerLevel: newRecord.dangerLevel,
        dangerDescription: newRecord.dangerDescription,
        timestamp: newRecord.timestamp,
      };
      dangerZones[existingIndex] = updatedZone;
      notifySubscribers();
      return NextResponse.json({ success: true, data: updatedZone });
    } else {
      // Insert at the front, keep only 50
      dangerZones = [newRecord, ...dangerZones.slice(0, 49)];
      notifySubscribers();
      return NextResponse.json({ success: true, data: newRecord });
    }
  } catch (error) {
    console.error('Error processing data:', error);
    return NextResponse.json(
      { error: 'Failed to process data' },
      { status: 500 }
    );
  }
}