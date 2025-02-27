'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { calculateDistance, formatDangerLevel } from '@/lib/utils';
import { AlertTriangle, Navigation, Info, MapPin, Thermometer, Wind, Droplets, Clock } from 'lucide-react';

// Dynamically import Leaflet components to fix hydration issues
const MapComponents = dynamic(
  () => import('@/components/MapComponents'),
  { 
    loading: () => <MapLoading />,
    ssr: false // This is crucial - prevents SSR for Leaflet components
  }
);

interface DangerZone {
  temperature: number;
  airQuality?: number;
  windSpeed?: number;
  humidity?: number;
  location: {
    lat: number;
    lng: number;
  };
  dangerLevel: string;
  dangerDescription: string;
  timestamp: string;
  id: string; // Adding unique identifier for each zone
}

function MapLoading() {
  return (
    <div className="flex flex-col justify-center items-center h-full w-full bg-gray-50 rounded-lg shadow-inner">
      <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-gray-700 font-medium">Loading forest fire map data...</p>
    </div>
  );
}

export default function DangerMap() {
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [nearestDangerZone, setNearestDangerZone] = useState<{
    zone: DangerZone;
    distance: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<DangerZone | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Setting up SSE for real-time updates
  useEffect(() => {
    const setupEventSource = () => {
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      // Create new SSE connection
      const eventSource = new EventSource('/inputData?subscribe=true');
      eventSourceRef.current = eventSource;
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.dangerZones) {
            // Add unique IDs if they don't exist
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const zonesWithIds = data.dangerZones.map((zone: any, index: number) => ({
              ...zone,
              id: zone.id || `zone-${index}-${Date.now()}`
            }));
            
            setDangerZones(zonesWithIds);
            setLastUpdated(new Date());
            setLoading(false);
          }
        } catch (err) {
          console.error('Failed to parse SSE data', err);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        // Try to reconnect after 5 seconds
        setTimeout(setupEventSource, 5000);
      };
    };
    
    setupEventSource();
    
    // Get user location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (err) => {
          console.error('Error getting user location:', err);
        }
      );
    }
    
    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Calculate nearest danger zone
  useEffect(() => {
    if (userLocation && dangerZones.length > 0) {
      let nearest = null;
      let minDistance = Infinity;

      dangerZones.forEach(zone => {
        const distance = calculateDistance(
          userLocation[0], 
          userLocation[1], 
          zone.location.lat, 
          zone.location.lng
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearest = { zone, distance };
        }
      });

      setNearestDangerZone(nearest);
    }
  }, [userLocation, dangerZones]);

  // Filter zones based on danger level
  const filteredZones = useMemo(() => {
    if (!filterLevel) return dangerZones;
    return dangerZones.filter(zone => zone.dangerLevel === filterLevel);
  }, [dangerZones, filterLevel]);

  // Default map center (Canada)
  const defaultCenter: [number, number] = [56.1304, -106.3468];
  const mapCenter = userLocation || (dangerZones.length > 0 
    ? [dangerZones[0].location.lat, dangerZones[0].location.lng] 
    : defaultCenter) as [number, number];

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow">
        <div className="flex">
          <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
          <div>
            <p className="text-red-700 font-medium">Error loading map data</p>
            <p className="text-red-600">{error}</p>
            <button 
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-red-600 p-4 rounded-lg shadow-lg">
        <h2 className="text-white text-2xl font-bold flex items-center">
          <AlertTriangle className="mr-2" /> Wildfire Monitoring System
        </h2>
        <p className="text-white opacity-90">
          Real-time tracking and alerts for forest fires and danger zones
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Filters and dashboard */}
        <div className="bg-white p-4 rounded-lg shadow-md lg:col-span-1">
          <div className="mb-4">
            <h3 className="text-lg text-black font-semibold mb-2 flex items-center">
              <Info className="w-5 h-5 mr-1 text-blue-600" /> Status Dashboard
            </h3>
            
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-md mb-2 shadow-sm">
              <div className="text-sm text-gray-600 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1 text-orange-500" /> Active Fires:
              </div>
              <div className="text-2xl font-bold text-gray-800">{dangerZones.length}</div>
            </div>
            
            {nearestDangerZone && (
              <div className={`p-3 rounded-md mb-2 shadow-sm ${
                nearestDangerZone.distance < 5 
                  ? "bg-gradient-to-r from-red-50 to-red-100" 
                  : nearestDangerZone.distance < 20
                    ? "bg-gradient-to-r from-yellow-50 to-yellow-100"
                    : "bg-gradient-to-r from-green-50 to-green-100"
              }`}>
                <div className="text-sm text-gray-600 flex items-center">
                  <MapPin className="w-4 h-4 mr-1 text-blue-600" /> Nearest Fire:
                </div>
                <div className="text-xl font-bold text-black">
                  {nearestDangerZone.distance.toFixed(1)} km away
                </div>
                <div className="text-sm text-black mt-1 flex items-center">
                  <span className={`w-3 h-3 rounded-full mr-1 ${
                    nearestDangerZone.zone.dangerLevel === "low" ? "bg-green-500" : 
                    nearestDangerZone.zone.dangerLevel === "medium" ? "bg-yellow-500" : 
                    nearestDangerZone.zone.dangerLevel === "high" ? "bg-orange-500" : 
                    "bg-red-600"
                  }`}></span>
                  {formatDangerLevel(nearestDangerZone.zone.dangerLevel)} severity
                </div>
              </div>
            )}
            
            {lastUpdated && (
              <div className="text-xs text-gray-500 mt-2 flex items-center">
                <Clock className="w-3 h-3 mr-1" /> Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
          
          <div className="mb-4">
              <h3 className="text-lg text-black font-semibold mb-2 flex items-center">
                <Navigation className="w-4 h-4 mr-1 text-blue-600" /> Filter by Severity
              </h3>
              <div className="space-y-2">
                <button 
                  onClick={() => setFilterLevel(null)}
                  className={`w-full py-2 px-3 rounded-md transition duration-200 ${
                    !filterLevel ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  All Zones
                </button>

                {/* Define color mapping to avoid Tailwind issues */}
                {[
                  { level: "low", colorClass: "bg-green-500" },
                  { level: "medium", colorClass: "bg-yellow-500" },
                  { level: "high", colorClass: "bg-orange-500" }, // Changed red to orange to avoid conflicts
                  { level: "extreme", colorClass: "bg-red-600" }
                ].map(({ level, colorClass }) => (
                  <button 
                    key={level}
                    onClick={() => setFilterLevel(level)}
                    className={`w-full py-2 px-3 rounded-md flex items-center justify-between transition duration-200 ${
                      filterLevel === level ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    <span className="flex items-center">
                      <span className={`w-3 h-3 rounded-full mr-2 ${colorClass}`}></span>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-30">
                      {dangerZones.filter(zone => zone.dangerLevel === level).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          
          {selectedZone && (
            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
              <h3 className="font-bold text-lg border-b border-gray-200 pb-2 mb-3 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                {formatDangerLevel(selectedZone.dangerLevel)} Alert Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-center bg-gray-50 p-2 rounded">
                  <Thermometer className="w-5 h-5 mr-2 text-red-500" />
                  <span className="text-gray-700 font-medium">Temperature: {selectedZone.temperature}°C</span>
                </div>
                
                {selectedZone.airQuality && (
                  <div className="flex items-center bg-gray-50 p-2 rounded">
                    <Wind className="w-5 h-5 mr-2 text-blue-500" />
                    <span className="text-gray-700 font-medium">Air Quality: {selectedZone.airQuality}</span>
                  </div>
                )}
                
                {selectedZone.windSpeed && (
                  <div className="flex items-center bg-gray-50 p-2 rounded">
                    <Wind className="w-5 h-5 mr-2 text-blue-500" />
                    <span className="text-gray-700 font-medium">Wind Speed: {selectedZone.windSpeed} km/h</span>
                  </div>
                )}
                
                {selectedZone.humidity && (
                  <div className="flex items-center bg-gray-50 p-2 rounded">
                    <Droplets className="w-5 h-5 mr-2 text-blue-500" />
                    <span className="text-gray-700 font-medium">Humidity: {selectedZone.humidity}%</span>
                  </div>
                )}
                
                <div className="text-sm mt-2 bg-gray-50 p-2 rounded">
                  <span className="font-medium">Description: </span>
                  {selectedZone.dangerDescription}
                </div>
                
                <div className="text-xs text-gray-600 mt-2 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Detected: {new Date(selectedZone.timestamp).toLocaleString()}
                </div>
                
                <button 
                  className="mt-3 w-full py-2 px-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition duration-200 shadow-sm"
                  onClick={() => setSelectedZone(null)}
                >
                  Close Details
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Map container */}
        <div className="h-[70vh] lg:h-[80vh] relative rounded-lg overflow-hidden shadow-lg lg:col-span-3 border border-gray-200">
          {loading && !mapReady ? (
            <MapLoading />
          ) : (
            <MapComponents
              mapCenter={mapCenter}
              dangerZones={filteredZones}
              userLocation={userLocation}
              nearestDangerZone={nearestDangerZone}
              onZoneSelect={setSelectedZone}
              onMapReady={() => setMapReady(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}