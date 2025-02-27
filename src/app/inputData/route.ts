// src/app/inputData/route.ts
import { NextResponse } from 'next/server';
import { assessDangerLevel, EnvironmentalData } from '@/lib/dangerLevels';

interface DangerZone {
  temperature: number;
  airQuality?: number;
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

  // Read the query params (?Temperature=...&AirQuality=...&Lat=...&Long=...)
  const Temperature = url.searchParams.get('Temperature');
  const AirQuality = url.searchParams.get('AirQuality');
  const LocationLat = url.searchParams.get('LocationLat');
  const LocationLong = url.searchParams.get('LocationLong');

  if (!Temperature || !LocationLat || !LocationLong) {
    return NextResponse.json({ dangerZones });
  }

  // If the request has those query params, treat it like environmental data input
  if (Temperature && LocationLat && LocationLong) {
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

      // Build the danger zone object
      const newDangerZone: DangerZone = {
        ...environmentalData,
        dangerLevel: assessment.level,
        dangerDescription: assessment.description,
        timestamp: new Date().toISOString(),
      };

      // Add to in-memory array
      dangerZones.push(newDangerZone);

      // Keep only the last 50 entries
      if (dangerZones.length > 50) {
        dangerZones = dangerZones.slice(-50);
      }

      // Notify all subscribers about the new data
      notifySubscribers();

      // Return success response
      return NextResponse.json({ 
        success: true, 
        data: newDangerZone 
      });
    } catch (error) {
      console.error('Error processing environmental data:', error);
      return NextResponse.json({ error: 'Failed to process data' }, { status: 500 });
    }
  }

  // If no query params, just return the full list of current danger zones
  return NextResponse.json({ dangerZones });
}