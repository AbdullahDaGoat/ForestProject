/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict';

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import webpush from 'web-push';
import { assessDangerLevel } from '../lib/dangerLevels';

const app = express();
const PORT = process.env.PORT || 3001;

// Create an HTTP server and integrate WebSockets
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow frontend to connect
    methods: ["GET", "POST"]
  }
});

// Set your VAPID keys (provided by you)
const VAPID_PUBLIC_KEY = "BMIlphB5UNplAcbs-4nVB9eHiIyawSQbd65fu8jm52PN4K5D_VYOhbwjcHDoCfXc02zl8xSYB0Rto8_zc6r3Qcs";
const VAPID_PRIVATE_KEY = "nHsNJydV8UDe8QGAJt3snIsInFYj08sf9saZ5hBCGaA";

webpush.setVapidDetails(
  'mailto:your-email@example.com', // Replace with your contact email
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Define the DangerZone type
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

// In-memory storage for danger zones (up to 50)
let dangerZones: DangerZone[] = [];

// In-memory storage for push subscriptions (for demo purposes; use a database in production)
const subscriptions: PushSubscription[] = [];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Environmental data input endpoint
app.get('/inputData', async (req: Request, res: Response): Promise<any> => {
  try {
    const { Temperature, AirQuality, LocationLat, LocationLong } = req.query;

    if (!Temperature || !LocationLat || !LocationLong) {
      return res.json({ dangerZones });
    }

    // Parse inputs
    const parsedTemperature = parseFloat(Temperature as string);
    const parsedAirQuality = AirQuality ? parseFloat(AirQuality as string) : undefined;
    const data = {
      temperature: parsedTemperature,
      airQuality: parsedAirQuality,
      location: {
        lat: parseFloat(LocationLat as string),
        lng: parseFloat(LocationLong as string)
      }
    };

    // Assess danger level
    const assessment = assessDangerLevel(data);

    // Create new danger zone
    const newDangerZone: DangerZone = {
      temperature: data.temperature,
      airQuality: parsedAirQuality !== undefined ? parsedAirQuality : "N/A",
      location: data.location,
      dangerLevel: assessment.level,
      dangerDescription: assessment.description,
      timestamp: new Date().toISOString()
    };

    // Store up to 50 records
    dangerZones = [newDangerZone, ...dangerZones.slice(0, 49)];

    // Emit event to all connected clients
    io.emit('dangerZoneUpdate', newDangerZone);

    return res.json({ success: true, data: newDangerZone });
  } catch (error) {
    console.error('Error processing data:', error);
    return res.status(500).json({ error: 'Failed to process environmental data' });
  }
});

// Endpoint to serve current danger zones
app.get('/dangerZones', async (req: Request, res: Response): Promise<any> => {
  return res.json({ dangerZones });
});

// Endpoint to save a push subscription
app.post('/api/save-subscription', (req: Request, res: Response) => {
  const subscription = req.body as PushSubscription;
  subscriptions.push(subscription);
  console.log('Subscription saved:', subscription);
  res.status(201).json({ message: 'Subscription saved successfully.' });
});

// Endpoint to trigger push notifications (simulate criteria met)
app.post('/api/trigger-notification', async (req: Request, res: Response) => {
  const { title, body, data } = req.body;
  const payload = JSON.stringify({ title, body, data });
  
  // For each stored subscription, cast it to unknown then to webpush.PushSubscription
  const sendPromises = subscriptions.map(sub =>
    webpush.sendNotification(sub as unknown as webpush.PushSubscription, payload).catch(err => {
      console.error('Error sending notification:', err);
    })
  );
  
  await Promise.all(sendPromises);
  res.status(200).json({ message: 'Notifications sent.' });
})

// WebSocket connection for real-time danger zone updates
io.on("connection", (socket) => {
  console.log("A client connected!");
  // Send initial danger zones
  socket.emit("initialData", dangerZones);

  socket.on("disconnect", () => {
    console.log("A client disconnected!");
  });
});

// Start HTTP & WebSocket server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;