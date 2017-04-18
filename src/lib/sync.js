"use strict"

const PouchDB = require('pouchdb');
const NeDB = require('nedb');
PouchDB.plugin(require('pouchdb-adapter-idb'));
const hash = require('object-hash');

var sync = {};

sync.remoteDB = function() {
    var configApp = app.config.app();
    if (!(configApp.db.remote.host) || !(configApp.user.name)) return
    var db_name = configApp.db.name;
    var indexDB = new PouchDB(db_name, {
        adapter: 'idb'
    });

    let {
        host,
        port
    } = configApp.db.remote;

    let {
        name,
        password
    } = configApp.user;

    var remoteDB = new PouchDB('http://' + host + ':' + port + '/' + db_name, {
        skip_setup: true,
        auth: {
            username: name,
            password: password
        }
    });

    var db_sync = indexDB.sync(remoteDB, {
        live: true,
        // filter: 'app/by_user',
        // query_params: {
        //     user: name
        // }
    }).on('error', function(err) {
        app.message.show('Alert', 'Synchronization to the remoted database failed.', 2000)
    })
}

sync.localDB = function() {
    app.db.indexDB.allDocs().then(function(docs) {
        if (docs.total_rows == 0) return
        docs.rows.map(function(doc) {
            var doc = app.db.indexDB.get(doc.id).then(function(doc) {
                if (!doc.network) return
                app.db.localDB.findOne({
                    _id: doc._id
                }).exec(function(err, docs) {
                    if (docs != null) return
                    doc.updatedAt = new Date;
                    app.db.localDB.insert(doc)
                })
            })
        })
    })
}

sync.defaults = function() {
    app.config.simulation().map(function(simConfigFile) {
        var simConfigName = simConfigFile.split('.')[0]
        var sim = app.config.simulation(simConfigName)
        app.db.localDB.findOne({
            _id: sim._id
        }).exec(function(err, docs) {
            sim.version = process.env.npm_package_version
            if (docs == null) {
                app.db.localDB.insert(sim)
            } else if (app.hash(docs) != app.hash(sim)) {
                app.db.localDB.update({_id: docs._id}, sim)
            }
        })
    })
}

sync.all = function() {
    sync.remoteDB()
    sync.localDB()
    sync.defaults()
}

module.exports = sync;
