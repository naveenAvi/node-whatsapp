const express = require("express")

const fs = require('fs');
const Mongotest = require("./TTT/MongoClient");
const Common = require("./common/Common");
const { default: axios } = require("axios");


process.on
(
    'uncaughtException',
    function (err)
    {
        console.log(err)
        var stack = err.stack;
        //you can also notify the err/stack to support via email or other APIs
    }
);

Mongotest.app.get('/delete', async (req, res, callback) => {
    fs.rmSync("sessions/" + req.query.deleteid, { recursive: true, force: true });

    return res.send("deleted")
});

Mongotest.app.get('/remove-sleep-sessions', async (req, res, callback) => {
    await Mongotest.RemoveSleepSessions(req, res, async (client) => {

    })
    
});
Mongotest.app.get('/start', async (req, res, callback) => {
    await Mongotest.instance(req, res, async (client) => {
        await Mongotest.getQRCOde(req, res)
    });
});
Mongotest.app.get('/startv2', async (req, res, callback) => {
    await Mongotest.instance(req, res, async (client) => {
    });
await Mongotest.sleep(4000)
    if (Mongotest.instanceStatus(req, res, callback) !== undefined) {
        //connected and whatsapp loaded
        isconnected = true;
    }
});
Mongotest.app.get('/LogSession', async (req, res, callback) => {
    await Mongotest.LogSession(req, res, callback)

});


Mongotest.app.get('/qr', async (req, res, callback) => {
    await Mongotest.getQRCOde(req, res, callback)

});

Mongotest.app.get('/mongo', async (req, res, callback) => {
    await Mongotest.testing(req, res, callback)

});

Mongotest.app.get('/isexists', async (req, res, callback) => {
    await Mongotest.sessionExists(req, res, callback)

});

Mongotest.app.get('/send', async (req, res, callback) => {
    await Mongotest.instance(req, res, async (client) => {
        await Mongotest.sendMessage(req, res)
    });
    //await Mongotest.sendMessage(req, res, callback)
});

Mongotest.app.get('/sendv3', async (req, res, callback) => {
    
    var messagedelivery = await Common.db_fetch("messagedeliver", [{ campaingid: req.query.campaingid }]);

    //should check campaing ownership
    var campaingdetails = await Common.db_fetch("campaings", [{ id: req.query.campaingid }]);
    if (!campaingdetails.length > 0) {
        return res.json({ status: '201', message: "camp_not_found" })
    } else {
        campaingdetails = campaingdetails[0]
    }
    var filedetails = null
    var fileName = null;
    if(campaingdetails.fileid !== null){
        filedetails = await Common.db_get("filecollection", [{ id: campaingdetails.fileid }]);
        fileName = filedetails.savedname
    }
    
    if (!messagedelivery) {
        Common.db_update("campaings", [{ status: "no_contacts" }, { id: req.query.campaingid }]);
        return res.json({ status: '201', message: "nocontac" })
    }
    
    var hasConnectedINstances = await Common.db_fetch("instances", [{ id: req.query.instance }, { status: "connected" }]);
    if (!hasConnectedINstances) {
        Common.db_update("campaings", [{ status: "notconne" }, { id: req.query.campaingid }]);
        return res.json({ status: '201', message: "not_connected" })
    }
    
    //it will try 3 times to wake up the instance
    let isconnected = false;
    let isLoggedOUt = false;
    for (let i = 0; i < 3; i++) {
        if (!isconnected) {
            await Mongotest.instance(req, res, async (client) => {
            });
            await Mongotest.sleep(4000)
            //following is 2 methods of checking. By checking instance user's name and by checking database status
            if (Mongotest.instanceStatus(req, res, callback) !== undefined) {
                //connected and whatsapp loaded
                isconnected = true;
            }
            var isCurrentconnected = await Common.db_fetch("instances", [{ id: req.query.instance }, { currentstatus: "connected" }]);
            if (isCurrentconnected) {
                isconnected = true;
            }
        }
        //checking instance state updates
        var hasInstance = await Common.db_fetch("instances", [{ id: req.query.instance }, { status: "closed" }]);
        if (hasInstance) {
            isLoggedOUt = true;
            Common.db_update("campaings", [{ status: "notconne" }, { id: req.query.campaingid }]);
            return res.json({ status: '201', message: "device_logged_out" })
        }
        let ll = Math.floor(Math.random() * (campaingdetails.timeintervalstarting + 8 - campaingdetails.timeintervalstarting + 1) + campaingdetails.timeintervalstarting)
        await Mongotest.sleep(ll * 1000)
    }
    
    if (campaingdetails.camptype === "image" || campaingdetails.camptype === "doc") {
        const respon = await axios.get('https://server.crowdsnap.co/get-file-content?filename=' + fileName, { responseType: 'arraybuffer' })
        //creating temp file
        await fs.writeFileSync(fileName, respon.data);
    }
    console.log("connected")


    if (isconnected) {

        await Mongotest.sleep(2000)
        await Mongotest.instance(req, res, async (client) => {
            for (let i = 0; i < messagedelivery.length; i++) {
                const messageto = messagedelivery[i];
                //let retults = await Mongotest.sendMessage(req, res)

                //aborting campaings
                var campaingabortstatus = await Common.db_fetch("campaings", [{ id: req.query.campaingid }, { status: "aborted" }]);
                if(campaingabortstatus){
                    //confirming aborted state
                    Common.db_update("campaings", [{status: "confaborted" }, { id: req.query.campaingid }]);
                    return false;
                }
                campaingabortstatus = await Common.db_fetch("campaings", [{ id: req.query.campaingid }, { status: "confaborted" }]);
                if(campaingabortstatus){
                    return false;
                }
                //finding message type
                if (campaingdetails.camptype === "simple") {
                    //sending a simple message
                    let retults = await Mongotest.sendMessage(req, res, messageto.contactno, campaingdetails)
                    //let retults = await Mongotest.sendImageMessage(req, res)
                    if (retults === "sent") {
                        //update messageDelivery status
                        Common.db_update("messagedeliver", [{ status: "1" }, { id: messageto.id }]);
                    } else {
                        Common.db_update("messagedeliver", [{ status: "2" }, { id: messageto.id }]);
                    }
                } else if (campaingdetails.camptype === "image") {
                    
                    let retults = await Mongotest.sendImageMessage(req, res, messageto.contactno, fileName, campaingdetails)
                    if (retults === "sent") {
                        //update messageDelivery status
                        Common.db_update("messagedeliver", [{ status: "1" }, { id: messageto.id }]);
                    } else {
                        Common.db_update("messagedeliver", [{ status: "2" }, { id: messageto.id }]);
                    }
                }else if( campaingdetails.camptype === "doc"){
                    
                    let retults = await Mongotest.sendDocumentMessage(req, res, messageto.contactno, fileName, campaingdetails)
                    if (retults === "sent") {
                        //update messageDelivery status
                        Common.db_update("messagedeliver", [{ status: "1" }, { id: messageto.id }]);
                    } else {
                        Common.db_update("messagedeliver", [{ status: "2" }, { id: messageto.id }]);
                    }
                }
                
                await Mongotest.sleep(campaingdetails.timeintervalstarting * 1000 )
            }
            Common.db_update("campaings", [{ status: "finished" }, { id: req.query.campaingid }]);
            return res.send("finished")
        });

    } else {
        Common.db_update("campaings", [{ status: "notconne" }, { id: req.query.campaingid }]);
        return res.send("not connected")
    }
    return res.send("sent")
    //await Mongotest.sendMessage(req, res, callback)
});

Mongotest.app.get('/send2', async (req, res, callback) => {
    await Mongotest.sendMessage(req, res)
    //await Mongotest.sendMessage(req, res, callback)

});

Mongotest.app.get('/sleep', async (req, res, callback) => {
    
    collection = await Common.db_get("contact_collections", [{ userid: "2" },  {collectionName:"New_contacts"}]);
    await Common.db_insert("contacts",[{collectionid: collection.id , name:"" , tpno: "", username: ""}])
    //await Mongotest.sendMessage(req, res, callback)
    console.log(collection)

});

Mongotest.server.listen(3000, () => {
    console.log("WAZIPER IS LIVE");
});


Mongotest.app.get('/databasetest', async (req, res, callback) => {
    Common.db_update("instances", [{ currentstatus: "dfgfdgdf" }, { id: 122 }]);
    res.json(Common.db_fetch("instances", []))
});