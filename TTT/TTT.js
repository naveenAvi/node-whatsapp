const express = require('express');
const http = require('http');
const qrimg = require('qr-image');
const app = express()
const fs = require('fs');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { Client, LegacySessionAuth } = require('whatsapp-web.js');
const sessions = {};
const new_sessions = {};

const io = new Server(server, {
    cors: {
        origin: '*',
    }
});
const TTT = {
	io: io,
    server: server,
    app: app,

	testing :  async function( req, res, callback ){
        sessions[req.query.instance] = "hello"

        return callback(JSON.stringify(sessions))
        res.send( JSON.stringify(sessions) )
    },
    createClient: async function(req, res, callback){
        // Path where the session data will be stored
        const SESSION_FILE_PATH = './session.json';

        // Load the session data if it has been previously saved
        let sessionData;
        if(fs.existsSync(SESSION_FILE_PATH)) {
            sessionData = require(SESSION_FILE_PATH);
        }
        const client = new Client({
            authStrategy: new LegacySessionAuth({
                session: sessionData
            })
        });

        sessions[req.query.instance] ={ client}
        sessions[req.query.instance].client.initialize();
        
        

        await client.on('qr', (qr) => {
            console.log('QR RECEIVED', qr);
            sessions[req.query.instance].qrcode =qr
        });

        await client.on('ready', () => {
            console.log('Client is ready!');
            sessions[req.query.instance].isready =undefined
            
        });

        // Save session values to the file upon successful auth
        client.on('authenticated', (session) => {
            sessionData = session;
            fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
                if (err) {
                    console.error(err);
                }
            });
        });
        
        
        //client.initialize();
         
        
        console.log(sessions[req.query.instance].qr)
        return callback(JSON.stringify({
            "qrin_session": sessions[req.query.instance].qr,
            "client created":"created",
            "length": sessions.length,
            

        }))
    },
    get_qrcode: async function(req, res, callback){
        var client = sessions[req.query.instance];

        //Check QR code exist
		for( var i = 0; i < 10; i++) {
			if( client.qrcode == undefined ){
		    	await async function (ms) {
                    return new Promise((resolve) => {
                      setTimeout(resolve, ms);
                    });
                  };
                }
		}

        // let qr = await new Promise((resolve, reject) => {
        //     client.once('qr', (qr) => resolve(qr))
        // })
        var code = qrimg.imageSync(client.qrcode, { type: 'png' });
        return res.json({ status: 'success', message: 'Success', base64: 'data:image/png;base64,'+code.toString('base64') });
        res.send(client.qrcode)
    },

    checkready: async function(req, res, callback){
        var client = sessions[req.query.instance];

        //Check QR code exist
		for( var i = 0; i < 10; i++) {
			if( client.isready == undefined ){
		    	await async function (ms) {
                    return new Promise((resolve) => {
                      setTimeout(resolve, ms);
                    });
                  };
                }
		}
        res.send(client.isready)
    },


};
module.exports = TTT;