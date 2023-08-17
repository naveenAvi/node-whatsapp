const express = require('express');
const http = require('http');
const qrimg = require('qr-image');
const app = express()
const server = http.createServer(app);
const { Server } = require("socket.io");
const sessions = {};
const new_sessions = {};

const io = new Server(server, {
    cors: {
        origin: '*',
    }
});
// import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys'
const {
	default: makeWASocket,
	BufferJSON,
	useMultiFileAuthState,
	DisconnectReason
} = require('@adiwajshing/baileys')

const WWW = {
    
	io: io,
    server: server,
    app: app,

	makeWASocket: async function(instance_id = "12"){
        
		const { state, saveCreds } = await useMultiFileAuthState('sessions/'+ "12");

		const WA = makeWASocket({
			auth: state,
			printQRInTerminal: false,
			receivedPendingNotifications: true,
			defaultQueryTimeoutMs: undefined,
			browser: [instance_id,'Chrome','96.0.4664.110'],
			patchMessageBeforeSending: (message) => {
                console.log(message)
	            const requiresPatch = !!(
	                message.buttonsMessage ||
	                // || message.templateMessage
	                message.listMessage
	            );
	            if (requiresPatch) {
	                message = {
	                    viewOnceMessage: {
	                        message: {
	                            messageContextInfo: {
	                                deviceListMetadataVersion: 2,
	                                deviceListMetadata: {},
	                            },
	                            ...message,
	                        },
	                    },
	                };
	            }
	             return message;
	        },
		});

		await WA.ev.on('connection.update', async ( { connection, lastDisconnect, isNewLogin, qr, receivedPendingNotifications } ) => {
            console.log("connection.update", connection)
			/*
			* Get QR COde
			*/
			if(qr != undefined){
				WA.qrcode = qr;
				if(new_sessions[instance_id] == undefined)
					new_sessions[instance_id] = new Date().getTime()/1000 + 300;
			}

			/*
			* Login successful
			*/
			if(isNewLogin){

				/*
				* Reload session after login successful
				*/
				await WWW.makeWASocket(instance_id);

			}

			if(lastDisconnect != undefined && lastDisconnect.error != undefined){
		    	var statusCode = lastDisconnect.error.output.statusCode;
		    	if( DisconnectReason.restartRequired == statusCode || DisconnectReason.connectionClosed == statusCode ){
	                await WWW.makeWASocket(instance_id);
		    	}
	    	}

			/*
			* Connection status
			*/
			switch(connection) {
			  	case "close":
			    	/*
			    	* 401 Unauthorized
			    	*/
			    	if(lastDisconnect.error != undefined){
				    	var statusCode = lastDisconnect.error.output.statusCode;
				    	if( DisconnectReason.loggedOut == statusCode || 0 == statusCode){
				    		var SESSION_PATH = session_dir + instance_id;
							if (fs.existsSync(SESSION_PATH)) {
		                        rimraf.sync(SESSION_PATH);
		                        delete sessions[instance_id];
    							delete chatbots[ instance_id ];
    							delete bulks[ instance_id ];
		                    }

		                    await WWW.session(instance_id);
				    	}
			    	}
			    	break;

			    case "open":
                    
			    	// Reload WASocket
			    	if(WA.user.name == undefined){
			    		await Common.sleep(3000);
                        
			    		await WWW.makeWASocket(instance_id);
			    		break;
			    	}
                    console.log(WA.user.name)
			    	sessions[instance_id] = WA;

					// Remove QR code
			    	if(sessions[instance_id].qrcode != undefined){
			    		delete sessions[instance_id].qrcode;
			    		delete new_sessions[instance_id];
			    	}

			    	await WWW.add_account(instance_id, session.team_id, WA.user, account);
			    	break;

			  	default:
			    	// code block
			}
		});

		

		return WA;
	},
    get_qrcode: async function(instance_id = 12, res){
		var client = sessions[instance_id];
        console.log("get_qr_code",client)
		if(client == undefined){
			return res.json({ status: 'error', message: "The WhatsApp session could not be found in the system" });
		}

		if(client.qrcode != undefined && !client.qrcode){
			return res.json({ status: 'error', message: "It seems that you have logged in successfully" });
		}

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

		if(client.qrcode == undefined || client.qrcode == false){
			return res.json({ status: 'error', message: "The system cannot generate a WhatsApp QR code" });
		}

		var code = qrimg.imageSync(client.qrcode, { type: 'png' });
    	return res.json({ status: 'success', message: 'Success', base64: 'data:image/png;base64,'+code.toString('base64') });
	},
    session: async function(instance_id = "12"){
		if( sessions[instance_id] == undefined ){
			sessions[instance_id] = await WWW.makeWASocket(instance_id);
		}

		return sessions[instance_id];
	},
    instance: async function(access_token, instance_id, res, callback){
		sessions["12"] = await WWW.session("12");
		return callback(sessions["12"]);
	},
    add_account: async function(instance_id, team_id, wa_info, account){
		console.log("add_Account",instance_id, team_id, wa_info, account )
	}
};
module.exports = WWW;