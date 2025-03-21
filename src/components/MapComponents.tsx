/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Circle, 
  Marker, 
  Popup, 
  Polyline, 
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDangerLevel } from '@/lib/utils';
import { MapPin, AlertTriangle, Flame, Plus, Minus, Navigation } from 'lucide-react';

// Fix for Leaflet default icon in Next.js
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

// Custom fire icon generator

const colorMap = {
  'extreme': '#8B0000',        // dark red
  'very high': 'rgb(220, 38, 38)', // red-600
  'high': 'rgb(234, 88, 12)',  // orange-600
  'medium': 'rgb(202, 138, 4)',// yellow-600
  'low': 'rgb(22, 163, 74)',   // green-600
  'normal': 'rgb(37, 99, 235)',// blue-600
  'no risk': 'rgb(37, 99, 235)'
};


const createFireIcon = (severity: string) => {
  const color = colorMap[severity as keyof typeof colorMap] || colorMap.medium;
  return L.divIcon({
    html: `
      <div class="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-lg border-2" style="border-color: ${color}">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" 
             viewBox="0 0 24 24" fill="none" stroke="${color}" 
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3
                   -1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 
                   2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3
                   a2.5 2.5 0 0 0 2.5 2.5z">
          </path>
        </svg>
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

// Custom user location icon
const createUserLocationIcon = () => {
  return L.divIcon({
    html: `
      <div class="flex items-center justify-center w-12 h-12 rounded-full">
        <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
        <div class="absolute w-12 h-12 bg-blue-400 rounded-full animate-ping opacity-30"></div>
      </div>
    `,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });
};

// Component to update the map view when center changes
function MapController({
  mapCenter,
  onMapReady,
}: {
  mapCenter: [number, number];
  onMapReady: () => void;
}) {
  const map = useMap();
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  useEffect(() => {
    if (!map) return;

    // Listen for the first drag event to mark that the user has interacted
    const handleDragStart = () => {
      setHasUserInteracted(true);
    };
    map.on('dragstart', handleDragStart);

    // Only set the view if the user hasn't interacted yet
    if (!hasUserInteracted) {
      map.setView(mapCenter, map.getZoom());
    }
    onMapReady();

    return () => {
      map.off('dragstart', handleDragStart);
    };
  }, [map, mapCenter, onMapReady, hasUserInteracted]);

  return null;
}


// Custom zoom control using react-leaflet's useMap hook
const CustomZoomControl = () => {
  const map = useMap();
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control flex flex-col space-y-2 m-3">
        <button
          className="p-2 bg-white rounded-md shadow-md hover:bg-gray-100 transition-colors border border-gray-300 flex items-center justify-center"
          onClick={() => map.zoomIn()}
          title="Zoom in"
        >
          <Plus className="w-5 h-5 text-gray-700" />
        </button>
        <button
          className="p-2 bg-white rounded-md shadow-md hover:bg-gray-100 transition-colors border border-gray-300 flex items-center justify-center"
          onClick={() => map.zoomOut()}
          title="Zoom out"
        >
          <Minus className="w-5 h-5 text-gray-700" />
        </button>
        <button
          className="p-2 bg-white rounded-md shadow-md hover:bg-gray-100 transition-colors border border-gray-300 flex items-center justify-center mt-4"
          onClick={() => map.locate({ setView: true, maxZoom: 16 })}
          title="Find my location"
        >
          <Navigation className="w-5 h-5 text-blue-600" />
        </button>
      </div>
    </div>
  );
};

// Main component for the Leaflet map
export default function MapComponents({
  mapCenter,
  dangerZones,
  userLocation,
  userLocationTimestamp,
  nearestDangerZone,
  onZoneSelect,
  onMapReady,
}: {
  mapCenter: [number, number];
  dangerZones: any[];
  userLocation: [number, number] | null;
  userLocationTimestamp: Date | null;
  nearestDangerZone: { zone: any; distance: number } | null;
  onZoneSelect: (zone: any) => void;
  onMapReady: () => void;
}) {
  useEffect(() => {
    fixLeafletIcon();
  }, []);
  
  const dangerColorOpacity = {
    'extreme': { color: '#ef4444', opacity: 0.5 },
    'high': { color: '#f97316', opacity: 0.45 },
    'medium': { color: '#eab308', opacity: 0.4 },
    'low': { color: '#22c55e', opacity: 0.35 }
  };

  return (
    <MapContainer
      center={mapCenter}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      className="z-0"
      attributionControl={false}
    >
      <MapController mapCenter={mapCenter} onMapReady={onMapReady} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {dangerZones.map((zone) => {
        const dangerStyle =
          dangerColorOpacity[zone.dangerLevel as keyof typeof dangerColorOpacity] ||
          dangerColorOpacity.medium;
        // Composite key using id and timestamp
        const zoneKey = `${zone.id}-${zone.timestamp}`;
        return (
          <Circle
            key={zoneKey}
            center={[zone.location.lat, zone.location.lng]}
            radius={5000}
            pathOptions={{
              color: dangerStyle.color,
              fillColor: dangerStyle.color,
              fillOpacity: dangerStyle.opacity,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onZoneSelect(zone),
            }}
          >
            <Marker
              position={[zone.location.lat, zone.location.lng]}
              icon={createFireIcon(zone.dangerLevel)}
              eventHandlers={{
                click: () => onZoneSelect(zone),
              }}
            >
              <Popup className="custom-popup">
                <div className="w-64 p-1">
                  <h3 className="font-bold flex items-center text-lg">
                    <Flame className="w-5 h-5 mr-2 text-red-500" />
                    {formatDangerLevel(zone.dangerLevel)} Alert
                  </h3>
                  <p className="text-sm my-2 text-gray-700">{zone.dangerDescription}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm bg-gray-50 p-2 rounded">
                    <div className="font-medium">Temperature: {zone.temperature}°C</div>
                    {zone.airQuality !== "N/A" && (
                      <div className="font-medium">Air Quality: {zone.airQuality}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Coordinates: {zone.location.lat.toFixed(4)}, {zone.location.lng.toFixed(4)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Detected: {new Date(zone.timestamp).toLocaleString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          </Circle>
        );
      })}
      {userLocation && (
        <Marker position={userLocation} icon={createUserLocationIcon()}>
          <Popup className="location-popup">
            <div className="p-1">
              <h3 className="font-bold flex items-center text-lg">
                <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                Your Location
              </h3>
              <div className="text-xs text-gray-500">
                Coordinates: {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
              </div>
              {userLocationTimestamp && (
                <div className="text-xs text-gray-500">
                  Last updated: {userLocationTimestamp.toLocaleTimeString()}
                </div>
              )}
              {nearestDangerZone && (
                <div className={`text-sm mt-2 p-2 rounded ${nearestDangerZone.distance < 5 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                  {nearestDangerZone.distance < 5 ? (
                    <div className="flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1 text-red-500" />
                      <span>You are within a <strong>{formatDangerLevel(nearestDangerZone.zone.dangerLevel)}</strong> danger zone!</span>
                    </div>
                  ) : (
                    <div>
                      <strong>{nearestDangerZone.distance.toFixed(1)} km</strong> from the nearest fire.
                    </div>
                  )}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      )}
      {userLocation && nearestDangerZone && nearestDangerZone.distance >= 5 && (
        <Polyline
          positions={[
            userLocation,
            [nearestDangerZone.zone.location.lat, nearestDangerZone.zone.location.lng],
          ]}
          color={nearestDangerZone.distance < 20 ? '#f97316' : '#3b82f6'}
          weight={3}
          dashArray="6, 10"
          opacity={0.7}
        />
      )}
      <CustomZoomControl />
    </MapContainer>
  );
}