const mysql = require('mysql');
const config = require("./../config.js");
const db_connect = mysql.createPool(config.database);

const Common = {
	db_query: async function(query, row){
		var res = await new Promise( async (resolve, reject)=>{
	        db_connect.query( query, (err, res)=>{
	            return resolve(res, true);
	        });
	    });

		return Common.response(res, row);
	},

	db_insert: async function(table, data){
		var res = await new Promise( async (resolve, reject)=>{
	        db_connect.query( "INSERT INTO "+table+" SET ?", data,  (err, res)=>{
	            return resolve(res, true);
	        });
	    });

		return res;
	},
	db_fetch: async function(table, data){
		var query = "SELECT * FROM "+table+" ";
		var where = "";
		if(data.length > 0){
			for (var i = 0; i < data.length; i++) {
				if(i == 0){
					where = where + " ?";
				}else{
					where = where + " AND ?";
				}
			}
		}

		if(where != ""){
			query = query + " WHERE " + where;
		}

		var res = await new Promise( async (resolve, reject)=> {
	        db_connect.query(query , data, (err, res)=>{
	            return resolve(res);
	        });
	    });

		return Common.response(res, false);
	},
	db_get: async function(table, data){
		var query = "SELECT * FROM "+table+" ";
		var where = "";
		if(data.length > 0){
			for (var i = 0; i < data.length; i++) {
				if(i == 0){
					where = where + " ?";
				}else{
					where = where + " AND ?";
				}
			}
		}

		if(where != ""){
			query = query + " WHERE " + where;
		}

		var res = await new Promise( async (resolve, reject)=> {
	        db_connect.query(query , data, (err, res)=>{
	            return resolve(res);
	        });
	    });

		return Common.response(res, true);
	},
    db_update: async function(table, data){
		var res = await new Promise( async (resolve, reject)=>{
	        db_connect.query( "UPDATE "+table+" SET ? WHERE ?", data, (err, res)=>{
				console.log(err)
	            return resolve(res, true);
	        });
	    });

		return res;
	},
	response: async function(res, row){
		if(res != undefined && res.length > 0){
			if(row || row == undefined){
				return res[0];
			}else{
				return res;
			}
			
		} 
		return false;
	},
}
module.exports = Common