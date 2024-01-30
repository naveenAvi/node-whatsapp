const express = require('express');
const http = require('http');
const qrimg = require('qr-image');
const app = express()
const fs = require('fs');
const server = http.createServer(app);
const { Server } = require("socket.io");
// Require database
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');


const io = new Server(server, {
    cors: {
        origin: '*',
    }
});
const Mongotest = {
    io: io,
    server: server,
    app: app,

    connect: async function(req, res, callback){
        // Load the session data
        console.log(process.env.MONGODB_URI)
        await mongoose.connect().then(() => {
            const store = new MongoStore({ mongoose: mongoose });
            const client = new Client({
                authStrategy: new RemoteAuth({
                    store: store,
                    backupSyncIntervalMs: 300000
                })
            });

            client.initialize();
            res.send("hey")
        });
        res.send("hey")
    }
    
 
}

module.exports = Mongotest
