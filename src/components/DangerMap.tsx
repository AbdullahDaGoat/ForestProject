/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { calculateDistance, formatDangerLevel } from '@/lib/utils';
import {
  AlertTriangle,
  Navigation,
  Info,
  MapPin,
  Clock
} from 'lucide-react';
// Import notification helpers so they're in scope
import { canNotify, showNotification } from '@/lib/notifications';

const MapComponents = dynamic(
  () => import('@/components/MapComponents'),
  { 
    loading: () => <MapLoading />,
    ssr: false
  }
);

interface DangerZone {
  temperature: number;
  airQuality?: number | "N/A";
  windSpeed?: number;
  humidity?: number;
  location: {
    lat: number;
    lng: number;
  };
  dangerLevel: string;
  dangerDescription: string;
  timestamp: string;
  id: string;
}

interface NearestZone {
  zone: DangerZone;
  distance: number;
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
  const [userLocationTimestamp, setUserLocationTimestamp] = useState<Date | null>(null);
  const [nearestDangerZone, setNearestDangerZone] = useState<NearestZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<DangerZone | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [usePolling, setUsePolling] = useState(false);
  // Throttle notifications to once every 10 seconds
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);

  // Define backend URL
  const BACKEND_URL = 'https://forestproject-backend-production.up.railway.app';

  const dangerLevelColorMap: Record<string, string> = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-orange-500",
    extreme: "bg-red-600",
    "no risk": "bg-blue-500"
  };

  const fetchDangerZonesData = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/inputData`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      if (data.dangerZones) {
        // Ensure each zone has a unique id
        const zonesWithIds = data.dangerZones.map((zone: any, index: number) => ({
          ...zone,
          id: zone.id || `zone-${index}-${Date.now()}`
        }));
        setDangerZones(zonesWithIds);
        setLastUpdated(new Date());
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch danger zones data:', err);
      setError('Failed to load data. Please check your connection and try again.');
    }
  }, [BACKEND_URL]);

  // Set up data fetching mechanism (SSE or polling)
  useEffect(() => {
    const setupEventSource = () => {
      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        const eventSource = new EventSource(`${BACKEND_URL}/inputData?subscribe=true`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('SSE connection established');
          reconnectAttemptsRef.current = 0;
          setUsePolling(false);
          // Initial data fetch to avoid waiting for the first SSE message
          fetchDangerZonesData();
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.dangerZones) {
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
          eventSource.close();
          if (reconnectAttemptsRef.current >= 3) {
            console.log('Falling back to polling after multiple SSE failures');
            setUsePolling(true);
            setupPolling();
            return;
          }
          const reconnectDelay = Math.min(2000 * Math.pow(1.5, reconnectAttemptsRef.current), 30000);
          console.log(`Attempting to reconnect SSE in ${reconnectDelay / 1000} seconds...`);
          setTimeout(setupEventSource, reconnectDelay);
          reconnectAttemptsRef.current++;
        };
      } catch (err) {
        console.error('Error setting up EventSource:', err);
        setUsePolling(true);
        setupPolling();
      }
    };

    const setupPolling = () => {
      console.log('Setting up polling for data updates');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      fetchDangerZonesData();
      pollingIntervalRef.current = setInterval(fetchDangerZonesData, 10000);
    };

    if (!usePolling) {
      setupEventSource();
    } else {
      setupPolling();
    }

    // Watch user location
    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setUserLocationTimestamp(new Date());
        },
        (err) => {
          console.error('Error getting user location:', err);
        },
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [usePolling, BACKEND_URL, fetchDangerZonesData]);

  // Calculate nearest danger zone and trigger notifications (throttled)
  useEffect(() => {
    if (userLocation && dangerZones.length > 0) {
      let nearest: NearestZone | null = null;
      let minDistance = Infinity;
      dangerZones.forEach((zone: DangerZone) => {
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

      if (nearest && canNotify()) {
        const now = Date.now();
        if (now - lastNotificationTime > 10000) {
          const typedNearest = nearest as NearestZone;
          if (typedNearest.distance < 5) {
            console.log("Triggering danger-zone notification:", typedNearest);
            showNotification('danger-zone', {
              title: '⚠️ You are in a danger zone!',
              body: `You are currently inside a ${typedNearest.zone.dangerLevel} risk area. Take necessary precautions.`,
              data: { zoneId: typedNearest.zone.id }
            });
            setLastNotificationTime(now);
          } else if (typedNearest.distance < 7 && typedNearest.distance >= 5) {
            console.log("Triggering approach-zone notification:", typedNearest);
            showNotification('approach-zone', {
              title: '⚡ Approaching danger zone',
              body: `You are ${Math.round(typedNearest.distance - 5)}km from a ${typedNearest.zone.dangerLevel} risk area. Be alert.`,
              data: { zoneId: typedNearest.zone.id }
            });
            setLastNotificationTime(now);
          }
        }
      }
    }
  }, [userLocation, dangerZones, lastNotificationTime]);

  // Filter danger zones by selected severity level
  const filteredZones = useMemo(() => {
    if (!filterLevel) return dangerZones;
    return dangerZones.filter(zone => zone.dangerLevel === filterLevel);
  }, [dangerZones, filterLevel]);

  const defaultCenter: [number, number] = [56.1304, -106.3468];
  const mapCenter = userLocation || (dangerZones.length > 0
    ? [dangerZones[0].location.lat, dangerZones[0].location.lng]
    : defaultCenter) as [number, number];

  const handleManualRefresh = () => {
    fetchDangerZonesData();
  };

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
        <div className="flex justify-between items-center">
          <h2 className="text-white text-2xl font-bold flex items-center">
            <AlertTriangle className="mr-2" /> Wildfire Monitoring System
          </h2>
          {usePolling && (
            <button 
              onClick={handleManualRefresh}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded-md text-white text-sm flex items-center transition"
            >
              <Clock className="w-4 h-4 mr-1" /> Refresh
            </button>
          )}
        </div>
        <p className="text-white opacity-90">
          Real-time tracking and alerts for forest fires and danger zones
          {usePolling && <span className="ml-2 text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded">Polling Mode</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar Dashboard */}
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
                  <span
                    className={`w-3 h-3 rounded-full mr-1 ${dangerLevelColorMap[nearestDangerZone.zone.dangerLevel || "no risk"] || "bg-gray-500"}`}
                  />
                  {formatDangerLevel(nearestDangerZone.zone.dangerLevel || "")} severity
                </div>
              </div>
            )}
            {lastUpdated && (
              <div className="text-xs text-gray-500 mt-2 flex items-center">
                <Clock className="w-3 h-3 mr-1" /> Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        {/* Map Container */}
        <div className="h-[70vh] lg:h-[80vh] relative rounded-lg overflow-hidden shadow-lg lg:col-span-3 border border-gray-200">
          {loading && !mapReady ? (
            <MapLoading />
          ) : (
            <MapComponents
              mapCenter={mapCenter}
              dangerZones={filteredZones}
              userLocation={userLocation}
              userLocationTimestamp={userLocationTimestamp}
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
