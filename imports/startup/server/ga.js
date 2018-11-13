const { google } = require('googleapis');

const scopes = 'https://www.googleapis.com/auth/analytics.readonly';
const email = 'ga-324@chhoetaigiwebsite.iam.gserviceaccount.com';
const jsonFile = '/chhoetaigiwebsite-22a755925ef2.json';
const viewID = '180234162';
const updatePeriod = 30000; // ms

const queries = [
    {
        'metrics': 'ga:sessions',
    },
    {
        'metrics': 'ga:totalEvents',
        'dimensions': 'ga:eventAction',
    },
];

import { Minimongo } from '../../api/minimongo/minimongo';

class GA {
    constructor() {
        this.run = false;
        this.queryNum = queries.length;
        this.queryIdx = 0;
    }

    start() {
        if (this.run) {
            this.stop();
        }
        this.run = true;
        this.intervalID = setInterval(this.get.bind(this), updatePeriod);
    }

    get() {
        let today = new Date();
        // year
        const yyyy = today.getFullYear();
        // month
        let mm = (today.getMonth() + 1) + ''; //January is 0!
        mm = new Array(2 - mm.length + 1).join('0') + mm
        // day
        let dd = today.getDate() + '';
        dd = new Array(2 - dd.length + 1).join('0') + dd
        
        today = yyyy + '-' + mm + '-' + dd;

        const jwtClient = new google.auth.JWT(
            email,
            jsonFile,
            null,
            scopes
        );
        
        // query
        const query = Object.assign({
            auth: jwtClient,
            'ids': 'ga:' + viewID,
            'start-date': '2018-01-01',
            'end-date': today
        }, queries[this.queryIdx]);

        // authorize
        jwtClient.authorize()
        .catch(error => console.log(error))
        .then(() => {
            google.analytics('v3').data.ga.get(query)
            .catch(error => console.log(error))
            .then(result => {
                //console.log(result.data);
                this.process(result.data.rows);
            });
        });
    }
    
    stop() {
        clearInterval(this.intervalID);
        this.run = false;
    }

    process(results) {
        //console.log(results);
        const minimongo = Minimongo.findOne();
        if (this.queryIdx === 0) {
            const sessions = results[0][0];
            Minimongo.update(minimongo, {$set: {sessions: sessions}}, {upsert: true});
        } else if (this.queryIdx === 1) {
            const clicks = results.find(e => e[0] === 'Search')[1];
            Minimongo.update(minimongo, {$set: {clicks: clicks}}, {upsert: true});
        }

        // update query index
        this.queryIdx = (this.queryIdx + 1) % this.queryNum;
    }
}

// check if only one record
let minimongo = Minimongo.find().fetch();
if (minimongo.length > 1) {
    Minimongo.remove({});
}

// check if GA data exists
minimongo = Minimongo.findOne({});
if (minimongo === undefined) {
    Minimongo.insert({
        sessions: 0,
        clicks: 0,
    });
} else {
    if (minimongo.sessions === undefined) {
        Minimongo.update(minimongo, {$set: {
            sessions: 0,
        }}, {upsert: true});
    }
    if (minimongo.clicks === undefined) {
        Minimongo.update(minimongo, {$set: {
            clicks: 0,
        }}, {upsert: true});
    }
}


const ga = new GA();
if (env === 'prod')
    ga.start();