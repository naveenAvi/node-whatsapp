var config = {
	debug: false,
	database: {
	    connectionLimit: 500,
	    host: "srv943.hstgr.io",
	    user: "u828084083_crowdsnap",
	    password: "tbDl9]jT0$",
	    database: "u828084083_crowdsnap",
	    charset : "utf8mb4",
	    debug: false,
	    waitForConnections: true,
	    multipleStatements: true
	},
	cors: {
		origin: '*',
 		optionsSuccessStatus: 200
	}
}

module.exports = config; 