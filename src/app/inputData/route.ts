import { NextResponse } from 'next/server';
import { assessDangerLevel, EnvironmentalData } from '@/lib/dangerLevels';
import { calculateDistance } from '@/lib/utils';

interface DangerZone {
  temperature: number;
  airQuality: number | string;
  location: { lat: number; lng: number };
  dangerLevel: string;
  dangerDescription: string;
  timestamp: string;
}

// In-memory database of danger zones (keep up to 50)
let dangerZones: DangerZone[] = [];

// SSE event emitters
const subscribers = new Set<ReadableStreamController<Uint8Array>>();

// Helper: Build the SSE string once, then encode once
function buildDangerZonesSSE() {
  const data = JSON.stringify({ dangerZones });
  return new TextEncoder().encode(`data: ${data}\n\n`);
}

// Notify all SSE subscribers about the latest dangerZones
function notifySubscribers() {
  const encodedData = buildDangerZonesSSE();
  for (const controller of subscribers) {
    controller.enqueue(encodedData);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Check if this is an SSE subscription request
  if (url.searchParams.get('subscribe') === 'true') {
    const stream = new ReadableStream({
      start(controller) {
        // Immediately send the current data
        controller.enqueue(buildDangerZonesSSE());
        // Register this controller in the subscriber set
        subscribers.add(controller);

        // Remove from the set when the client disconnects
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

  // Handle normal GET request with query params
  const Temperature = url.searchParams.get('Temperature');
  const AirQuality = url.searchParams.get('AirQuality');
  const LocationLat = url.searchParams.get('LocationLat');
  const LocationLong = url.searchParams.get('LocationLong');

  // If required data is missing, simply return all danger zones
  if (!Temperature || !LocationLat || !LocationLong) {
    return NextResponse.json({ dangerZones });
  }

  try {
    // Parse the values
    const environmentalData: EnvironmentalData = {
      temperature: parseFloat(Temperature),
      airQuality: AirQuality ? parseFloat(AirQuality) : undefined,
      location: {
        lat: parseFloat(LocationLat),
        lng: parseFloat(LocationLong),
      },
    };

    // Assess the danger level
    const assessment = assessDangerLevel(environmentalData);

    // Check if there's an existing danger zone within 5km
    const existingIndex = dangerZones.findIndex(zone => {
      const dist = calculateDistance(
        zone.location.lat,
        zone.location.lng,
        environmentalData.location.lat,
        environmentalData.location.lng
      );
      return dist < 5;
    });

    if (existingIndex !== -1) {
      // Update the existing zone; keep original location
      const updatedZone = {
        ...dangerZones[existingIndex],
        temperature: environmentalData.temperature,
        airQuality: environmentalData.airQuality !== undefined ? environmentalData.airQuality : "N/A",
        dangerLevel: assessment.level,
        dangerDescription: assessment.description,
        timestamp: new Date().toISOString(),
      };
      dangerZones[existingIndex] = updatedZone;

      notifySubscribers();
      return NextResponse.json({ success: true, data: updatedZone });
    } else {
      // Create a new danger zone
      const newDangerZone: DangerZone = {
        temperature: environmentalData.temperature,
        airQuality: environmentalData.airQuality !== undefined ? environmentalData.airQuality : "N/A",
        location: environmentalData.location,
        dangerLevel: assessment.level,
        dangerDescription: assessment.description,
        timestamp: new Date().toISOString(),
      };

      // Insert at the front, keep only the latest 50 entries in one pass
      dangerZones = [newDangerZone, ...dangerZones.slice(0, 49)];

      notifySubscribers();
      return NextResponse.json({ success: true, data: newDangerZone });
    }
  } catch (error) {
    console.error('Error processing environmental data:', error);
    return NextResponse.json({ error: 'Failed to process data' }, { status: 500 });
  }
}
