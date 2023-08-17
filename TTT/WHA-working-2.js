const express = require('express');
const http = require('http');
const qrimg = require('qr-image');
const app = express()
const fs = require('fs');
const server = http.createServer(app);
const { Server } = require("socket.io");
const P = require('pino');

const {
    default: makeWASocket,
    BufferJSON,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const Common = require('../common/Common');

const sessions = {};
const new_sessions = {};

const io = new Server(server, {
    cors: {
        origin: '*',
    }
});
const MongoClient = {
    io: io,
    server: server,
    app: app,

    testing: async function (req, res, callback) {
        sessions[req.query.instance] = "hello"

        Common.db_update("instances", [ { status: 0 }, { id: 80 } ]);

        return callback(JSON.stringify(sessions))
        res.send(JSON.stringify(sessions))
    },
    sessionExists: async function (req, res, callback) {
        if(sessions[req.query.instance]){
            res.send(JSON.stringify({sessionexists: "true"}))
        }else{
            res.send(JSON.stringify({sessionexists: "false"}))
        }
    },
    getQRCOde: async function (req, res, callback) {
        if(sessions[req.query.instance] == undefined){
            res.send("session_not_created:" + req.query.instance)
            return
        }
        if(sessions[req.query.instance].qr ==undefined){
            sessions[req.query.instance] = await MongoClient.makeWASocket(req, res);
        }
        var code = qrimg.imageSync(sessions[req.query.instance].qr, { type: 'png' });
        return res.json({ status: 'success', message: sessions[req.query.instance].qr, base64: 'data:image/png;base64,' + code.toString('base64') });
        res.send(sessions[req.query.instance].qr)
    },
    // sendMessage: async function (req, res, callback) {
    //     const id = '94763853638@s.whatsapp.net'
    //     await sessions[req.query.instance].sendMessage(id, { text: 'oh hello there' })

    //     res.send("sent")
    // },
    sendMessage: async function (req, res, callback) {
        const id = '94763853638@s.whatsapp.net'
        // send a buttons message!
        const buttons = [
            { buttonId: 'id1', buttonText: { displayText: 'Button 1' }, type: 1 },
            { buttonId: 'id2', buttonText: { displayText: 'Button 2' }, type: 1 },
            { buttonId: 'id3', buttonText: { displayText: 'Button 3' }, type: 1 }
        ]

        const buttonMessage = {
            text: "Hi it's button message",
            footer: 'Hello World',
            buttons: buttons,
            headerType: 1
        }
        const sentMsg = await sessions[req.query.instance].sendMessage(id, { text: 'Hi, this was sent using https://github.com/adiwajshing/baileys' })

        await sessions[req.query.instance].sendMessage(id, buttonMessage)

        res.send("sent")
    },
    LogSession: async function (req, res, callback) {
        fs.writeFile('lolantha.json', JSON.stringify(sessions), function () { });
        res.send("session logged")
    },
   
    makeWASocket: async function (req, res) {
        const { state, saveCreds } = await useMultiFileAuthState('sessions/' + req.query.instance);
        sessions[req.query.instance] = { browser: "none" }
        const WA = makeWASocket({
            // can provide additional config here
            logger: P({ level: 'silent' }),
            auth: state,
            headless: false,
            printQRInTerminal: false,
            browser: [req.query.instance, 'Chrome', '96.0.4664.110'],
        })

        await WA.ev.on('connection.update', async ({ connection, lastDisconnect, isNewLogin, qr, receivedPendingNotifications }) => {
            console.log("qr:  ", req.query.instance, qr)
            console.log(connection)
            console.log(lastDisconnect)

            if (qr != undefined) {
                WA.qrcode = qr;
                sessions[req.query.instance].qr = qr
            }

            if (isNewLogin) {

                /*
                * Reload session after login successful
                */
                await MongoClient.makeWASocket(req, res);

            }

            if (lastDisconnect != undefined && lastDisconnect.error != undefined) {
                var statusCode = lastDisconnect.error.output.statusCode;
                if (DisconnectReason.restartRequired == statusCode || DisconnectReason.connectionClosed == statusCode) {
                    await MongoClient.makeWASocket(req, res);
                }
            }

            switch (connection) {
                case "close":
                    console.log("closed: ", connection)
                    console.log(" use another instance: ", qr, connection)
                    //sessions[req.query.instance] = undefined;
                    //delete sessions[req.query.instance];
                    //save session status in database
                    Common.db_update("instances", [ { currentstatus: "closed" }, { id: req.query.instance } ]);
                    break;
                case "connecting":
                        await MongoClient.sleep(2000)
                        sessions[req.query.instance] = WA;

                        //save session status in database
                        Common.db_update("instances", [ { currentstatus: "connecting" }, { id: req.query.instance } ]);
                        break;
                case "open":
                    // Reload WASocket
                    if (WA.user.name == undefined) {
                        console.log("realoading")
                        await MongoClient.sleep(2000)
                        //await MongoClient.makeWASocket(req);
                        break;
                    }
                    if (WA.user.name != undefined) {
                        console.log("realoading")
                        await MongoClient.sleep(2000)
                        //await MongoClient.makeWASocket(req);
                        //save session status in database
                        Common.db_update("instances", [ { status: "connected" }, { id: req.query.instance } ]);
                        Common.db_update("instances", [ { currentstatus: "connected" }, { id: req.query.instance } ]);
                        break;
                    }
                    console.log(WA.user.name)
                    sessions[req.query.instance] = WA;


                    
                    break;

                default:
                // code block
            }
            res.send("hello")
        })

        await WA.ev.on('creds.update', saveCreds)
        await WA.ev.on('messages.upsert', async (messages) => {
            console.log(messages)
            var chat_id = messages.messages[0].key.remoteJid;
            var messagedata = messages.messages[0]
            var now = new Date().getTime() / 1000;
            if (messages !== undefined) {
                if (messagedata.key.fromMe === false) {
                    if (messagedata.broadcast === false) {
                        console.log(sessions[req.query.instance].messagelistresponds)
                        if (sessions[req.query.instance].messagelistresponds === undefined) {
                            sessions[req.query.instance].messagelistresponds = [messagedata.key.id]
                            console.log("new message. no prev response")
                            WA.sendMessage(messagedata.key.remoteJid, { text: 'Hello there!' })
                        } else {
                            if (!sessions[req.query.instance].messagelistresponds.includes(messagedata.key.id)) {
                                console.log("new message")
                                WA.sendMessage(messagedata.key.remoteJid, { text: 'Hello there!' })
                            }
                            sessions[req.query.instance].messagelistresponds = [...sessions[req.query.instance].messagelistresponds, messagedata.key.id]
                        }
                    }
                }


                fs.writeFile('myjsonfile.json', JSON.stringify(messages.messages[0]));


                console.log(messages.messages[0].key.remoteJid)
                //console.log(messages.WebMessageInfo.message)
                //WA.sendMessage(messages[0].key.remoteJid, { text: 'Hello there!' })
            }
        })
        return WA
    },
    session: async function(req, res){
		if( sessions[req.query.instance] == undefined ){
			sessions[req.query.instance] = await MongoClient.makeWASocket(req, res);
		}

		return sessions[req.query.instance];
	},
    instance: async function(req, res, callback){
		//authenticate instance
        // if(!session){
        // 	if(res){
	    //     	return res.json({ status: 'error', message: "The Instance ID provided has been invalidated" });
	    //     }else{
	    //     	return callback(false);
	    //     }
        // }
        if(sessions[req.query.instance] === undefined){
            console.log("creating_session_")
            sessions[req.query.instance] = await MongoClient.session(req, res);
        }

		
		return callback(sessions[req.query.instance]);
	},
    sleep: async function (ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    },
    

};
module.exports = MongoClient;

