const express = require('express');
const http = require('http');
const qrimg = require('qr-image');
const axios = require('axios');
const app = express()
const fs = require('fs');
const server = http.createServer(app);
const { Server } = require("socket.io");
const P = require('pino');

const {
    default: makeWASocket,
    BufferJSON,
    useMultiFileAuthState,
    makeInMemoryStore,
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

        Common.db_update("instances", [{ status: 0 }, { id: 80 }]);

        return callback(JSON.stringify(sessions))
        res.send(JSON.stringify(sessions))
    },
    sessionExists: async function (req, res, callback) {
        if (sessions[req.query.instance]) {
            var isready = sessions[req.query.instance].ws._readyState
            res.send(JSON.stringify({ sessionexists: "true", isready }))
        } else {
            res.send(JSON.stringify({ sessionexists: "false" }))
        }
    },
    getQRCOde: async function (req, res, callback) {
        console.log("get qr")
        if (sessions[req.query.instance] == undefined) {
            return res.json({ status: 'session_not_created', instanceID: req.query.instance });

        }
        if (sessions[req.query.instance].qr == undefined) {
            sessions[req.query.instance] = await MongoClient.makeWASocket(req, res);
        }
        try {
            var code = qrimg.imageSync(sessions[req.query.instance].qr, { type: 'png' });
            return res.json({ termMessage: "qrgot", status: 'success', message: sessions[req.query.instance].qr, base64: 'data:image/png;base64,' + code.toString('base64') });
        } catch (error) {
            return res.json({ status: 'failed_qr', message: error, });
        }

        res.send(sessions[req.query.instance].qr)
    },
    // sendMessage: async function (req, res, callback) {
    //     const id = '94763853638@s.whatsapp.net'
    //     await sessions[req.query.instance].sendMessage(id, { text: 'oh hello there' })

    //     res.send("sent")
    // },
    sendDocumentMessage: async function (req, res, id, docName, campaingdetails) {
        //const id = '94763853638@s.whatsapp.net'
        try {
            await sessions[req.query.instance].sendMessage(
                id,
                {
                    document: fs.readFileSync(docName),
                    fileName: "hello.pdf",
                    caption: campaingdetails.message
                }
            )
            return "sent";
        } catch (error) {
            console.log("image sending error", error)
            return "failed";
        }
    },

    sendImageMessage: async function (req, res,id, imagefilename, campaingdetails) {
        //const id = '94763853638@s.whatsapp.net'
        try {
            await sessions[req.query.instance].sendMessage(
                id,
                {
                    image: fs.readFileSync(imagefilename),
                    caption: campaingdetails.message,
                    gifPlayback: true
                }
            )
            return "sent";
        } catch (error) {
            console.log("image sending error", error)
            return "failed";
        }
    },
    sendMessage: async function (req, res, id, campaingdetails) {
        //const id = '94763853638@s.whatsapp.net'
        try {
            const sentMsg = await sessions[req.query.instance].sendMessage(id, { text: campaingdetails.message })
            return "sent";
        } catch (error) {
            console.log("simple message sending error")
            console.log(error)
            return "failed";
        }
    },
    LogSession: async function (req, res, callback) {
        fs.writeFile('lolantha.json', JSON.stringify(sessions), function () { });
        res.send("session logged")
    },

    RemoveSleepSessions: async function (req, res, callback) {
        //sessions[req.query.instance]
        sessions.map(item => {
            console.log(item)
        })
        for(const val of sessions) {
            console.log(val)
        }
    },

    makeWASocket: async function (req, res) {
        const { state, saveCreds } = await useMultiFileAuthState('sessions/' + req.query.instance);
        sessions[req.query.instance] = { browser: "none" }
        const store = makeInMemoryStore({})
        const WA = makeWASocket({
            // can provide additional config here
            //logger: P({ level: 'debug' }),
            auth: state,
            headless: false,
            printQRInTerminal: false,
            //browser: [req.query.instance, 'Chrome', '96.0.4664.110'],
        })

        // store.bind(WA.ev)

        // setInterval(() => {
        //     store.writeToFile('./baileys_store.json')
        //     console.log("sssss chats",store.chats.all())
        //     console.log("contacts",store.contacts)
        //     console.log("messages",store.messages)
        // }, 10_000)

        await WA.ev.on('connection.update', async ({ connection, lastDisconnect, isNewLogin, qr, receivedPendingNotifications }) => {
            console.log("qr:  ", req.query.instance, qr)
            console.log(connection)

            if (qr != undefined) {
                var arethereanyconnectedinstances = await Common.db_fetch("instances", [{ id: req.query.instance }, { status: "connected" }]);
                if (arethereanyconnectedinstances) {
                    //has logout sessions
                    
                    //return res.status(200).json({ status: 'failed_connection', message: "is_logout_instance" });
                }
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
                    if (lastDisconnect.error != undefined) {
                        var statusCode = lastDisconnect.error.output.statusCode;
                        if (DisconnectReason.loggedOut == statusCode || 0 == statusCode) {
                            //save session status in database
                            Common.db_update("instances", [{ status: "closed" }, { id: req.query.instance }]);
                            //logouted
                            var SESSION_PATH = "sessions/" + req.query.instance;
                            if (fs.existsSync(SESSION_PATH)) {
                                fs.rmSync(SESSION_PATH, { recursive: true, force: true });
                                delete sessions[req.query.instance];
                            }
                        }
                    } else {
                        //save session status in database
                        sessions[req.query.instance].connectionstatus = "closed"
                        Common.db_update("instances", [{ currentstatus: "closed" }, { id: req.query.instance }]);
                        sessions[req.query.instance] = await MongoClient.makeWASocket(req, res);
                    }
                    break;
                case "connecting":
                    await MongoClient.sleep(2000)
                    sessions[req.query.instance] = WA;

                    sessions[req.query.instance].connectionstatus = "connecting"
                    //save session status in database
                    Common.db_update("instances", [{ currentstatus: "connecting" }, { id: req.query.instance }]);
                    break;
                case "open":
                    // Reload WASocket
                    if (WA.user.name == undefined) {
                        console.log("realoading")
                        await MongoClient.sleep(2000)
                        await MongoClient.makeWASocket(req, res);
                        break;
                    }
                    if (WA.user.name != undefined) {
                        console.log("realoading")
                        await MongoClient.sleep(2000)
                        //await MongoClient.makeWASocket(req);
                        //save session status in database
                        sessions[req.query.instance].connectionstatus = "connected"
                        await Common.db_update("instances", [{ status: "connected" }, { id: req.query.instance }]);
                        Common.db_update("instances", [{ currentstatus: "connected" }, { id: req.query.instance }]);
                        break;
                    }
                    console.log(WA)
                    console.log(WA.user.name)
                    sessions[req.query.instance] = WA;
                    break;

                default:
                // code block
            }
        })

        await WA.ev.on('creds.update', saveCreds)
        await WA.ev.on('messaging-history.set', async (chats, contacts, messages) => {
            console.log("chats")
            console.log("contacts")
        })
        await WA.ev.on('contacts.set', () => {
            console.log('got contacts', Object.values(store.contacts))
        })
        await WA.ev.on('chats.set', () => {
            // can use "store.chats" however you want, even after the socket dies out
            // "chats" => a KeyedDB instance
            console.log('got chats chats.set', store.chats.all())
        })
        await WA.ev.on('messaging-history.set', (chats, contacts) => {
            // can use "store.chats" however you want, even after the socket dies out
            // "chats" => a KeyedDB instance
            console.log('got chats mesaging-history', chats)
            console.log('got chats', contacts)
        })
        await WA.ev.on('chats.upsert', async (chat) => {
            // can use "store.chats" however you want, even after the socket dies out
            // "chats" => a KeyedDB instance
            //getting instance owner id

            console.log("ll")
            let instancedata = await Common.db_get("instances", [{ id: req.query.instance }]);
            if (instancedata) {
                if (chat[0].id.includes("@g.us")) {
                    //it is a group id	userid	groupid	groupname	
                    let istpalreadyin = await Common.db_get("goups", [{ userid: instancedata.userid }, { groupid: chat[0].id }]);
                    if (!istpalreadyin) {
                        await Common.db_insert("goups", [{ userid: instancedata.userid, groupid: chat[0].id, groupname: chat[0].name }])
                    }
                } else {
                    //it is a user
                    let collection = await Common.db_get("contact_collections", [{ userid: instancedata.userid }, { collectionName: "New_contacts" }]);
                    if (!collection) {
                        //create collection if doesn't exists
                        await Common.db_insert("contact_collections", [{ userid: instancedata.userid, collectionName: "New_contacts", status: 1 }])
                    }
                    collection = await Common.db_get("contact_collections", [{ userid: instancedata.userid }, { collectionName: "New_contacts" }]);
                    //collectionid	 name	tpno	username

                    let istpalreadyin = await Common.db_get("contacts", [{ userid: instancedata.userid }, { username: chat[0].id }]);
                    if (!istpalreadyin) {
                        await Common.db_insert("contacts", [{ collectionid: collection.id, name: "", tpno: "+" + chat[0].id.replace("@s.whatsapp.net", ""), username: chat[0].id }])
                    }
                }
            }
        })

        await WA.ev.on('messages.upsert', async (messages) => {
            console.log("message reciew")
            var chat_id = messages.messages[0].key.remoteJid;
            console.log(chat_id);
            var messagedata = messages.messages[0]
            var now = new Date().getTime() / 1000;
            if (chat_id.includes("@s.whatsapp.net")) {
                if (messages !== undefined) {
                    if (messagedata.key.fromMe === false) {
                        if (messagedata.broadcast === false) {
                            console.log(sessions[req.query.instance].messagelistresponds)
                            if (sessions[req.query.instance].messagelistresponds === undefined) {
                                sessions[req.query.instance].messagelistresponds = [messagedata.key.id]
                                console.log("new message. no prev response")
                               // WA.sendMessage(messagedata.key.remoteJid, { text: 'Hello there!' })
                            } else {
                                if (!sessions[req.query.instance].messagelistresponds.includes(messagedata.key.id)) {
                                    console.log("new message")
                                    //WA.sendMessage(messagedata.key.remoteJid, { text: 'Hello there!' })
                                }
                                sessions[req.query.instance].messagelistresponds = [...sessions[req.query.instance].messagelistresponds, messagedata.key.id]
                            }
                        }
                    }
                    //fs.writeFile('myjsonfile.json', JSON.stringify(messages.messages[0]));
                    //console.log(messages.WebMessageInfo.message)

                    //WA.sendMessage(messages.messages[0].key.remoteJid, { text: 'Hello there!' })
                }
            }
        })
        return WA
    },
    session: async function (req, res) {
        if (sessions[req.query.instance] == undefined) {
            sessions[req.query.instance] = await MongoClient.makeWASocket(req, res);
        }

        return sessions[req.query.instance];
    },
    instance: async function (req, res, callback) {
        //authenticate instance
        // if(!session){
        // 	if(res){
        //     	return res.json({ status: 'error', message: "The Instance ID provided has been invalidated" });
        //     }else{
        //     	return callback(false);
        //     }
        // }
        if (sessions[req.query.instance] === undefined) {
            console.log("creating_session_")
            sessions[req.query.instance] = await MongoClient.makeWASocket(req, res);
        }


        return callback(sessions[req.query.instance]);
    },
    instanceStatus: async function (req, res, callback) {
        return sessions[req.query.instance].user.name
    },
    sleep: async function (ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    },


};
module.exports = MongoClient;

