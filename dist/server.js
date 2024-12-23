"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer);
const roomCodeMap = {}; // Stores the current state of the editor for each room
const userSocketMap = {}; // Maps socket IDs to user names
// Get all connected clients in a specific room
function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            userName: userSocketMap[socketId], // Get the username using the socketId
        };
    });
}
io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socket.on("join", ({ roomId, userName }) => {
        userSocketMap[socket.id] = userName; // Map socket ID to user name
        socket.join(roomId);
        // Fetch the current list of clients in the room
        const clients = getAllConnectedClients(roomId);
        // Update the state for this room if it doesn't already exist
        if (!roomCodeMap[roomId]) {
            roomCodeMap[roomId] = "// Welcome to the collaborative editor!";
        }
        // Send the current code state to the newly joined client
        socket.emit("editor-change", { content: roomCodeMap[roomId] });
        // Notify all clients (including the newly joined one) of the updated room state
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit("joined", {
                clients,
                userName,
                socketId: socket.id,
            });
        });
        console.log(`${userName} joined room: ${roomId}`);
    });
    // Handle editor changes
    socket.on("editor-change", ({ content }) => {
        // Find the room the socket is in
        const rooms = [...socket.rooms].filter((room) => room !== socket.id);
        if (rooms.length === 0)
            return;
        const roomId = rooms[0];
        roomCodeMap[roomId] = content; // Update the room's current code state
        // Broadcast the changes to all other clients in the room
        socket.to(roomId).emit("editor-change", { content });
    });
    socket.on("disconnecting", () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.to(roomId).emit("disconnected", {
                socketId: socket.id,
                userName: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
    });
    socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
