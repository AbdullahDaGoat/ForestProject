/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import PushNotificationSetup from '@/components/PushNotificationSetup';
import { HelpCircle, AlertTriangle, Info, Map, Clock, Menu, X } from 'lucide-react';

// Import the map component dynamically with no SSR
const DangerMap = dynamic(() => import('@/components/DangerMap'), { ssr: false });

export default function Home() {
  const [stats, setStats] = useState({
    activeFireCount: 0,
    highRiskZones: 0,
    averageTemperature: 0,
    lastUpdate: ''
  });
  
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('map');
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
            const highRiskCount = data.dangerZones.filter((zone: { dangerLevel: string; }) => 
              zone.dangerLevel === 'high' || zone.dangerLevel === 'extreme'
            ).length;
            
            const averageTemp = data.dangerZones.length > 0 
              ? data.dangerZones.reduce((sum: any, zone: { temperature: any; }) => sum + zone.temperature, 0) / data.dangerZones.length 
              : 0;
              
            setStats({
              activeFireCount: data.dangerZones.length,
              highRiskZones: highRiskCount,
              averageTemperature: Math.round(averageTemp * 10) / 10,
              lastUpdate: new Date().toLocaleTimeString()
            });
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
    
    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <AlertTriangle className="text-red-600 dark:text-red-500 mr-2" size={24} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Environmental Monitoring Dashboard</h1>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
              <Clock size={16} className="mr-1" />
              Last updated: {stats.lastUpdate || 'Loading...'}
            </span>
            <Link
              href="/inputData"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 px-3 rounded-md transition"
            >
              View Raw Data
            </Link>
          </div>
          
          <button 
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden text-gray-600 dark:text-gray-200"
          >
            {mobileSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>
      
      <div className="container mx-auto px-4 md:flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:block w-64 pr-4 py-6">
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Status Overview</h2>
              
              <div className="grid gap-3">
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                  <div className="text-xs text-red-600 dark:text-red-400 font-medium">Active Fires</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-500">{stats.activeFireCount}</div>
                </div>
                
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900">
                  <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">High Risk Zones</div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-500">{stats.highRiskZones}</div>
                </div>
                
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Avg Temperature</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">{stats.averageTemperature}°C</div>
                </div>
              </div>
            </div>
            
            {/* Push Notifications */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <PushNotificationSetup />
            </div>
          </div>
        </aside>
        
        {/* Mobile Sidebar */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-gray-900/80 flex justify-end">
            <div className="w-3/4 bg-white dark:bg-gray-800 h-full overflow-y-auto p-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">ForestGuard Menu</h2>
                <button onClick={() => setMobileSidebarOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm p-4 space-y-3">
                  <h3 className="text-md font-medium">Status Overview</h3>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                      <div className="text-xs text-red-600 dark:text-red-400">Fires</div>
                      <div className="text-lg font-bold text-red-600 dark:text-red-500">{stats.activeFireCount}</div>
                    </div>
                    
                    <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900">
                      <div className="text-xs text-orange-600 dark:text-orange-400">High Risk</div>
                      <div className="text-lg font-bold text-orange-600 dark:text-orange-500">{stats.highRiskZones}</div>
                    </div>
                    
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900">
                      <div className="text-xs text-blue-600 dark:text-blue-400">Avg Temp</div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-500">{stats.averageTemperature}°C</div>
                    </div>
                  </div>
                </div>
                
                <PushNotificationSetup />
                
                <div className="mt-4">
                  <Link
                    href="/inputData"
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-md transition"
                  >
                    View Raw Data
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <main className="flex-1 py-6">
          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6 p-1">
            <div className="flex">
              <button 
                onClick={() => setActiveTab('map')}
                className={`flex items-center justify-center py-2 px-4 rounded-lg text-sm font-medium flex-1 ${
                  activeTab === 'map' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/30'
                }`}
              >
                <Map size={16} className="mr-1.5" />
                Monitoring Map
              </button>
              <button 
                onClick={() => setActiveTab('info')}
                className={`flex items-center justify-center py-2 px-4 rounded-lg text-sm font-medium flex-1 ${
                  activeTab === 'info' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/30'
                }`}
              >
                <Info size={16} className="mr-1.5" />
                About & Legend
              </button>
            </div>
          </div>
          
          {/* Map Tab */}
          {activeTab === 'map' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="relative">
                <div className="h-[75vh] w-full">
                  <DangerMap />
                </div> 
              </div>
            </div>
          )}
          
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">About ForestGuard</h2>
                
                <div className="prose dark:prose-invert prose-sm">
                  <p className="mb-4">
                    ForestGuard provides real-time environmental monitoring and wildfire detection using data collected from our drone fleet. Our system uses advanced thermal imaging, air quality sensors, and AI algorithms to detect potential fire risks before they become dangerous.
                  </p>
                  
                  <h3 className="text-lg font-semibold mb-2">How to interpret the map:</h3>
                  
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg mb-6">
                    <h4 className="font-semibold mb-2">Risk Level Classifications</h4>
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600 mt-0.5"></div>
                        <div className="ml-3">
                          <h5 className="font-medium text-red-700 dark:text-red-400">Extreme Risk</h5>
                          <p className="text-gray-600 dark:text-gray-300 text-sm">Temperature above 60°C, signs of active fire, immediate evacuation required.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500 mt-0.5"></div>
                        <div className="ml-3">
                          <h5 className="font-medium text-orange-700 dark:text-orange-400">High Risk</h5>
                          <p className="text-gray-600 dark:text-gray-300 text-sm">Temperature 45-60°C, extremely dry conditions, high probability of fire ignition.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-500 mt-0.5"></div>
                        <div className="ml-3">
                          <h5 className="font-medium text-yellow-700 dark:text-yellow-400">Moderate Risk</h5>
                          <p className="text-gray-600 dark:text-gray-300 text-sm">Temperature 30-45°C, dry conditions, caution advised.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 mt-0.5"></div>
                        <div className="ml-3">
                          <h5 className="font-medium text-green-700 dark:text-green-400">Low Risk</h5>
                          <p className="text-gray-600 dark:text-gray-300 text-sm">Temperature below 30°C, normal conditions, regular monitoring.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-2">Staying Safe</h3>
                  <p className="mb-2">
                    Enable push notifications to receive real-time alerts when fire risks are detected near your location. Always follow evacuation orders from local authorities.
                  </p>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500 mt-6">
                    <div className="flex">
                      <HelpCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <div className="ml-3">
                        <h4 className="font-medium text-blue-700 dark:text-blue-400">Need Help?</h4>
                        <p className="text-sm text-blue-600 dark:text-blue-300">
                          For emergency assistance, call 911.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 shadow-inner py-4 mt-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>ForestGuard - Real-time Environmental Monitoring System</p>
          <p className="text-xs mt-1">Data updates automatically in real-time. Last update: {stats.lastUpdate || 'Loading...'}</p>
        </div>
      </footer>
    </div>
  );
}