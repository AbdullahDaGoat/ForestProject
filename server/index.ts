// server/index.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict';

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as webpush from 'web-push'; // Change to use namespace import
import next from 'next';
import { assessDangerLevel } from '@/lib/dangerLevels';

// 1) Configure Next.js
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler(); // Next's default route handler

// 2) Wrap everything in an async start function
async function startServer() {
  // Prepare the Next build (waits for .next folder to be ready)
  await nextApp.prepare();

  // 3) Create your Express app
  const app = express();
  const PORT = process.env.PORT || 3001;

  // 4) Create HTTP and WebSocket server from Express
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // 5) Set your VAPID keys
  const VAPID_PUBLIC_KEY = "BMIlphB5UNplAcbs-4nVB9eHiIyawSQbd65fu8jm52PN4K5D_VYOhbwjcHDoCfXc02zl8xSYB0Rto8_zc6r3Qcs";
  const VAPID_PRIVATE_KEY = "nHsNJydV8UDe8QGAJt3snIsInFYj08sf9saZ5hBCGaA";

  webpush.setVapidDetails(
    'mailto:abdullahaviator13@gmail.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  // 6) Define DangerZone type
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

  // In-memory storage
  let dangerZones: DangerZone[] = [];
  const subscriptions: PushSubscription[] = [];

  // 7) Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 8) Define your custom endpoints

  // Example: GET /inputData (like your existing route)
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

  // Endpoint to save push subscription
  app.post('/api/save-subscription', (req: Request, res: Response) => {
    const subscription = req.body as PushSubscription;
    subscriptions.push(subscription);
    console.log('Subscription saved:', subscription);
    res.status(201).json({ message: 'Subscription saved successfully.' });
  });

  // Endpoint to trigger push notifications
  app.post('/api/trigger-notification', async (req: Request, res: Response) => {
    const { title, body, data } = req.body;
    const payload = JSON.stringify({ title, body, data });

    // Send to each subscription
    const sendPromises = subscriptions.map((sub) => {
      return webpush
        .sendNotification(sub as unknown as webpush.PushSubscription, payload)
        .catch((err) => console.error('Error sending notification:', err));
    });

    await Promise.all(sendPromises);
    res.status(200).json({ message: 'Notifications sent.' });
  });

  // 9) WebSocket connection for real-time danger zone updates
  io.on('connection', (socket) => {
    console.log("A client connected!");
    // Send initial data
    socket.emit("initialData", dangerZones);

    socket.on("disconnect", () => {
      console.log("A client disconnected!");
    });
  });

  // 10) Let Next.js handle everything else
  //    (Any route not handled above will go to Next)
  app.all('*', (req: Request, res: Response) => {
    return handle(req, res);
  });

  // 11) Start the server
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// 12) Invoke the async start function
startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

