const chatHandler = require("./chatHandler");
const adminHandler = require("./adminHandler");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    // Bind specific event handlers
    chatHandler(io, socket);
    adminHandler(io, socket);

    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);
    });
  });
};
