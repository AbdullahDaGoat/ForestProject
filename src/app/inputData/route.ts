// src/app/inputData/route.ts
import { NextResponse } from 'next/server';
import { assessDangerLevel, EnvironmentalData } from '@/lib/dangerLevels';
import { calculateDistance } from '@/lib/utils';

interface DangerZone {
  temperature: number;
  airQuality: number | "N/A";
  location: {
    lat: number;
    lng: number;
  };
  dangerLevel: string;
  dangerDescription: string;
  timestamp: string;
}

// Simulated database of danger zones
let dangerZones: DangerZone[] = [];

// SSE event emitter setup
const subscribers = new Set<ReadableStreamController<Uint8Array>>();

function notifySubscribers() {
  subscribers.forEach(controller => {
    const data = JSON.stringify({ dangerZones });
    controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Check if this is an SSE connection request
  if (url.searchParams.get('subscribe') === 'true') {
    const stream = new ReadableStream({
      start(controller) {
        // Send initial data
        const data = JSON.stringify({ dangerZones });
        controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        
        // Add this client to subscribers
        subscribers.add(controller);
        
        // Remove subscriber when connection closes
        request.signal.addEventListener('abort', () => {
          subscribers.delete(controller);
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }

  // Read the query params (?Temperature=...&AirQuality=...&LocationLat=...&LocationLong=...)
  const Temperature = url.searchParams.get('Temperature');
  const AirQuality = url.searchParams.get('AirQuality');
  const LocationLat = url.searchParams.get('LocationLat');
  const LocationLong = url.searchParams.get('LocationLong');

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

    // Check if there's an existing danger zone within 5km of its starting location
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
      // Update the existing danger zone.
      // Note: We keep the original zone location.
      dangerZones[existingIndex] = {
        ...dangerZones[existingIndex],
        temperature: environmentalData.temperature,
        airQuality: environmentalData.airQuality !== undefined ? environmentalData.airQuality : "N/A",
        dangerLevel: assessment.level,
        dangerDescription: assessment.description,
        timestamp: new Date().toISOString(),
      };
      const updatedZone = dangerZones[existingIndex];
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

      // Add the new zone to the beginning of the array
      dangerZones = [newDangerZone, ...dangerZones];
      // Ensure we keep only the latest 50 entries
      if (dangerZones.length > 50) {
        dangerZones = dangerZones.slice(0, 50);
      }
      notifySubscribers();
      return NextResponse.json({ success: true, data: newDangerZone });
    }
  } catch (error) {
    console.error('Error processing environmental data:', error);
    return NextResponse.json({ error: 'Failed to process data' }, { status: 500 });
  }
}
