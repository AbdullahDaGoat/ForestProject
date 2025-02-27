/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
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

// Define the DangerZone type
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

// In-memory storage for danger zones (up to 50)
let dangerZones: DangerZone[] = [];

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

    // Convert inputs to correct types
    const data = {
      temperature: parseFloat(Temperature as string),
      airQuality: AirQuality ? parseFloat(AirQuality as string) : undefined,
      location: {
        lat: parseFloat(LocationLat as string),
        lng: parseFloat(LocationLong as string)
      }
    };

    // Process danger level
    const assessment = assessDangerLevel(data);

    // Create a new danger zone
    const newDangerZone: DangerZone = {
      ...data,
      dangerLevel: assessment.level,
      dangerDescription: assessment.description,
      timestamp: new Date().toISOString()
    };

    // Store up to 50 records
    dangerZones = [newDangerZone, ...dangerZones.slice(0, 49)];

    // Emit event to all clients when a new danger zone is added
    io.emit('dangerZoneUpdate', newDangerZone);

    return res.json({ success: true, data: newDangerZone });
  } catch (error) {
    console.error('Error processing data:', error);
    return res.status(500).json({ error: 'Failed to process environmental data' });
  }
});

// Serve real-time danger zones
app.get('/dangerZones', async (req: Request, res: Response): Promise<any> => {
  return res.json({ dangerZones });
});

// WebSocket Connection
io.on("connection", (socket) => {
  console.log("A client connected!");

  // Send the latest danger zones when a client connects
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
