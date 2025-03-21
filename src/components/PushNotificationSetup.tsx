/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

// Your public VAPID key (must be base64 URL-safe)
const SERVER_PUBLIC_KEY = "BFvwfwSPtFBlC6QOB8h2RcapVKbn0PL3Yxj4J96pQIwkWu4fWTjgqv1eJ9N8lfk4sMPVKZkt19BCI49kMuQcpns";
// Your backend URL (where push subscriptions are stored)
const BACKEND_URL = 'https://forestproject-backend-production.up.railway.app';

export default function PushNotificationSetup() {
  const [permission, setPermission] = useState<NotificationPermission | 'default'>('default');
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationRange, setNotificationRange] = useState<number>(2);
  // Add a status state to better track the subscription process
  const [subscriptionStatus, setSubscriptionStatus] = useState<'inactive' | 'pending' | 'active' | 'failed'>('inactive');
  
  // Handle messages from service worker
  const handleServiceWorkerMessage = (event: MessageEvent) => {
    console.log('Message from SW:', event.data);
    
    if (event.data && event.data.type === 'SUBSCRIPTION_STATE_UPDATE') {
      // Update UI based on service worker state
      setLoading(false);
      if (event.data.state === 'enabled') {
        setSubscriptionStatus('active');
      } else if (event.data.state === 'disabled') {
        setSubscriptionStatus('inactive');
      } else if (event.data.state === 'error') {
        setSubscriptionStatus('failed');
        setError('Service worker reported an error with notifications');
      }
    }
    
    if (event.data && event.data.type === 'NOTIFICATION_SHOWN') {
      console.log('Notification shown confirmation received');
      // Notification was successfully shown, ensure UI is updated
      setSubscriptionStatus('active');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isPushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      
      if (isPushSupported) {
        setPermission(Notification.permission);
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        
        // Make sure SW is registered and ready before checking for subscription
        const checkSubscription = async () => {
          try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
              console.log("Existing subscription found:", subscription);
              setPushSubscription(subscription);
              setSubscriptionStatus('active');
              
              // Verify the subscription with the backend
              try {
                const response = await fetch(`${BACKEND_URL}/verify-subscription`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ endpoint: subscription.endpoint })
                });
                
                if (!response.ok) {
                  console.warn('Subscription verification failed, may need to resubscribe');
                }
              } catch (verifyErr) {
                console.warn('Failed to verify subscription with backend:', verifyErr);
              }
            } else {
              setSubscriptionStatus('inactive');
            }
          } catch (err) {
            console.error("Error checking for existing subscription:", err);
            setSubscriptionStatus('failed');
          }
        };
        
        checkSubscription();
        
        return () => {
          navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
        };
      }
    }
    
    // Load notification range from localStorage
    const savedRange = localStorage.getItem('notificationRange');
    if (savedRange) {
      setNotificationRange(parseInt(savedRange));
    }
  }, []);

  // Helper: Convert a base64 URL-safe string to a Uint8Array.
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Subscribe the user to push notifications with improved error handling and mobile support
  const subscribeToPush = async () => {
    setLoading(true);
    setError(null);
    setSubscriptionStatus('pending');
    
    try {
      // First ensure notification permission is granted
      if (Notification.permission !== 'granted') {
        // On mobile, it's better to request permission as a result of user interaction
        const permissionResult = await Notification.requestPermission();
        setPermission(permissionResult);
        if (permissionResult !== 'granted') {
          setError('Notification permission denied');
          setLoading(false);
          setSubscriptionStatus('failed');
          return;
        }
      }
      
      // Make sure service worker is ready
      const registration = await navigator.serviceWorker.ready;
      console.log("Service worker ready:", registration);
      
      // Check if we already have a subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        try {
          // Create new subscription with improved error handling
          console.log("Creating new push subscription...");
          
          const applicationServerKey = urlBase64ToUint8Array(SERVER_PUBLIC_KEY);
          
          // Mobile browsers sometimes hang on subscribe, so use Promise.race with timeout
          subscription = await Promise.race([
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error("Push subscription timed out")), 15000)
            )
          ]);
          
          if (!subscription) {
            throw new Error("Subscription creation failed");
          }
          
          console.log("New subscription created successfully:", subscription);
          
          // Send subscription to backend
          const response = await fetch(`${BACKEND_URL}/save-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription,
              userAgent: navigator.userAgent,
              deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to save subscription to backend: ${response.status}`);
          }
          
          console.log("Subscription saved to backend successfully");
          
          // Important: Send a message to the service worker about the subscription
          // This helps deal with the UI getting stuck issue
          const swController = navigator.serviceWorker.controller;
          if (swController) {
            swController.postMessage({
              type: 'SUBSCRIPTION_SUCCESSFUL',
              subscription: subscription.endpoint
            });
          }
          
          // Test notification to verify everything is working
          await fetch(`${BACKEND_URL}/send-test-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
          
          setPushSubscription(subscription);
          setSubscriptionStatus('active');
          
        } catch (subscribeErr: any) {
          console.error("Error in push subscription process:", subscribeErr);
          setError(`Subscription error: ${subscribeErr.message || 'Unknown error'}`);
          setSubscriptionStatus('failed');
          
          // Try to recover by unsubscribing if we got a partial subscription
          if (subscription) {
            try {
              await subscription.unsubscribe();
            } catch (unsubErr) {
              console.warn("Cleanup after failed subscription failed:", unsubErr);
            }
          }
          
          setLoading(false);
          return;
        }
      } else {
        console.log("Using existing subscription:", subscription);
        setPushSubscription(subscription);
        
        // Ensure the subscription is registered on the server
        try {
          const response = await fetch(`${BACKEND_URL}/save-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription,
              userAgent: navigator.userAgent,
              deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            })
          });
          
          if (!response.ok) {
            throw new Error("Failed to update existing subscription");
          }
          
          // Notify the service worker about the existing subscription
          const swController = navigator.serviceWorker.controller;
          if (swController) {
            swController.postMessage({
              type: 'SUBSCRIPTION_SUCCESSFUL',
              subscription: subscription.endpoint
            });
          }
          
          setSubscriptionStatus('active');
        } catch (err) {
          console.warn("Failed to update existing subscription:", err);
          // Continue anyway as the subscription exists locally
        }
      }
      
    } catch (err: any) {
      console.error("Push notification setup failed:", err);
      setError(`Setup failed: ${err.message || 'Unknown error'}`);
      setSubscriptionStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  // Unsubscribe from push notifications.
  const unsubscribeFromPush = async () => {
    setLoading(true);
    try {
      if (pushSubscription) {
        // First send unsubscribe request to backend so it stops sending notifications
        try {
          const endpoint = pushSubscription.endpoint;
          await fetch(`${BACKEND_URL}/remove-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint })
          });
        } catch (err) {
          console.warn("Could not notify backend about unsubscribe, continuing anyway:", err);
        }
        
        // Now unsubscribe locally
        await pushSubscription.unsubscribe();
        setPushSubscription(null);
        setSubscriptionStatus('inactive');
        
        // Cleanup any background sync registration if supported
        const registration = await navigator.serviceWorker.ready;
        if ('periodicSync' in registration) {
          await (registration as any).periodicSync.unregister('environmental-check');
        }
        
        console.log("Unsubscribed from push notifications successfully");
      }
    } catch (err: any) {
      console.error("Failed to unsubscribe:", err);
      setError(`Unsubscribe failed: ${err.message || 'Unknown error'}`);
      setSubscriptionStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setNotificationRange(value);
    localStorage.setItem('notificationRange', value.toString());
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <Bell className="mr-2 h-5 w-5" />
          Environmental Alert Settings
        </h3>
        <p className="text-blue-100 text-sm mt-1">
          Customize how and when you receive critical environmental alerts
        </p>
      </div>
      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
        <div className="space-y-6">
          {/* Push Notifications Section */}
          <div className="border-b border-gray-100 pb-6">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Push Notifications</h4>
            {permission === 'granted' ? (
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">Notifications enabled</p>
                  <p className="text-green-700 text-sm mt-1">
                    You&apos;ll receive real-time alerts for environmental hazards.
                  </p>
                  {subscriptionStatus === 'active' ? (
                    <button
                      onClick={unsubscribeFromPush}
                      disabled={loading}
                      className="mt-3 text-sm font-medium text-red-600 hover:text-red-800 flex items-center"
                    >
                      {loading ? 'Processing...' : 'Disable notifications'}
                    </button>
                  ) : (
                    <button
                      onClick={subscribeToPush}
                      disabled={loading}
                      className="mt-3 bg-green-100 text-green-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-green-200 transition"
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Enabling...
                        </span>
                      ) : 'Enable push notifications'}
                    </button>
                  )}
                </div>
              </div>
            ) : permission === 'denied' ? (
              <div className="flex items-start space-x-3 bg-red-50 border border-red-100 rounded-lg p-4">
                <XCircle className="h-6 w-6 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800">Notifications blocked</p>
                  <p className="text-red-700 text-sm mt-1">
                    Please update your browser settings to enable environmental alerts.
                  </p>
                  <div className="mt-3">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        // Different instructions depending on browser/OS
                        alert("To enable notifications, please check your browser settings and ensure notifications are allowed for this site.");
                      }}
                      className="text-red-600 text-sm font-medium underline hover:text-red-800"
                    >
                      Learn how to enable notifications
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-4">
                <div className="mt-1 bg-blue-100 p-2 rounded-full flex-shrink-0">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Receive critical alerts</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Get notified about forest fires, air quality warnings, and other environmental hazards near your location.
                  </p>
                  <button
                    onClick={subscribeToPush}
                    disabled={loading}
                    className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow-sm"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Bell className="h-4 w-4 mr-1.5" />
                        Enable Alert Notifications
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Notification Range Section */}
          <div className="border-b border-gray-100 pb-6">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Notification Range</h4>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Choose how far from a danger zone you want to receive alerts:
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={notificationRange}
                  onChange={handleRangeChange}
                  className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>1km</span>
                <span>2km</span>
                <span>3km</span>
                <span>4km</span>
                <span>5km</span>
              </div>
              <p className="text-sm font-medium text-gray-700 mt-2">
                Current setting: Notify me when I&apos;m within {notificationRange}km of a danger zone border
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}