const q = require('daskeyboard-applet');
const request = require('request-promise');
const apiUrl = "https://api.weather.gov";
const logger = q.logger;


class WeatherAlerts extends q.DesktopApp {
    constructor() {
        super();
        this.zoneName = null;
        // run every 15 min
        this.pollingInterval = 15 * 60 * 1000;
        logger.info("WeatherAlerts ready");
        //logger.info("Origin is: " + this.getOriginX() + ", " + this.getOriginY())
    }

    async downloadAlerts(zone) {
        const url = apiUrl + "/alerts/active?zone=" + zone;
    
        var headers = { 'User-Agent': 'request(q-applet-weather)',
                    'Accept': 'application/json' };
    
        return request.get({
            url: url,
            headers: headers,
            json: true
            }).then(body => {
                return body;
            }).catch((error) => {
            logger.info('Error when trying to downloadAlerts', error);
            throw new Error('Error when trying to downloadAlerts: ', error);
            })
    }
    
    compareSeverity(currentSev, newSeverity) {
        const severityMap = { 'Extreme':  1,
                              'Severe':   2,
                              'Moderate': 3,
                              'Minor':    4,
                              'Unknown':  9
                            };
    
        try {
            if(severityMap[newSeverity] < severityMap[currentSev]){ return newSeverity; }
            else { return currentSev; }
        } catch (error) {
            logger.info("Error matching severity ", $newSeverity, ": ", error);
        }
    }

    async getActiveSignals(x,y) {
        const pid = 'Q_MATRIX'
        const url = "http://localhost:27301/api/1.0/signals/pid/" + pid + "/zoneId/" + x + "," + y;

        return request.get({
            url: url,
            json: true,
            resolveWithFullResponse: true
            }).then(body => {
                logger.info('Active Sigal response: ', body);
                return body;
            }).catch((err) => {
            if(err.message.search(/StatusCodeError\: 404/)){
                logger.info('No Active Signals');
                return null;
            }
            logger.error('Error when trying to getActiveSignals: ', err.message );
            throw new Error('Error when trying to getActiveSignals: ', err);
            })

    }

    async clearSignal(signal_id) {
        const pid = 'Q_MATRIX'
        const url = "http://localhost:27301/api/1.0/signals/" + signal_id;
        const headers = { 'User-Agent': 'request(q-applet-weather)', 'Content-Type': 'application/json' };

        logger.info('Clearing Signal ' + signal_id)

        return request.delete({
            url: url,
            headers: headers,
            json: true
            }).then(body => {
                return body;
            }).catch((error) => {
            logger.info('Error when trying to clearSignal', error);
            throw new Error('Error when trying to clearSignal: ', error);
            })

    }

    async run() {
        logger.info("Weather Alerts running.");
        var max_severity = 'Unknown';
        var alert_text = '';
        var alert_oids = [];
        var active_signals;
        var active_signal_id;
        var active_alerts;

        
        //const nws_zone_id=this.config.nws_zone_id;
        //const nws_same_id=this.config.nws_same_id;
        const nws_zone_id = 'TXZ173';
        const nws_same_id='948491';



        const severityFormat = { 'Extreme': [this.config.colorExtreme, 'BLINK'],
                                'Severe':   [this.config.colorSevere, 'SET_COLOR'],
                                'Moderate': [this.config.colorModerate, 'SET_COLOR'],
                                'Minor':    [this.config.colorMinor, 'SET_COLOR'],
                                'Unknown':  [this.config.colorUnknown, 'SET_COLOR'] };

        if (!nws_zone_id) {
            logger.info('No zoneId configured');
            return null;        
        } else {

            try {
                //(this.getOriginX(), this.getOriginY());
                active_signals = await this.getActiveSignals(11, 0);
                if (active_signals) {
                    active_alerts = active_signals.message.match(/<label hidden>OID\:(.*)<\/label>/m);
                    active_signal_id = active_signals.id;
                    logger.info("Active Alerts: " + active_signals.id + " OID:" + active_alerts[1]);
                }
    
            } catch(error) {
                logger.error('Unable to retrieve active signals: ' + error);
            }

            logger.info("My zone ID is  : " + nws_zone_id);

            const alertjson = await this.downloadAlerts(nws_zone_id);
            //logger.info("Received Alert" + JSON.stringify(alertjson));
            try {
                const features = alertjson.features;
                logger.info("Parsing Response Length " + alertjson.features.length);
                features.forEach(alert => {
                    logger.info('Alert: ' + alert.properties.id);

                    if (nws_same_id === "" || alert.properties.geocode.SAME.includes(nws_same_id)) {
                        // Send signal if SAME id is blank or if SAME id is configured and matched in alert
                        logger.info("Alert matching SAME id: " + nws_same_id);
                        max_severity = this.compareSeverity(max_severity, alert.properties.severity);
                        alert_text = alert_text + "<div><b>" + alert.properties.headline + "</b></div>";
                        alert_text = alert_text + "<div><b>Severity: " + alert.properties.severity + "</b><div>";
                        alert_text = alert_text + "<div>" + alert.properties.description + "</div>";

                        alert_oids.push(alert.properties.id);
                        //alert.properties.instruction ? alert_text = alert_text + "<div>" + alert.properties.instruction + "</div>" : {};

                        logger.info(alert_text, "\n\n");
                        logger.info("max_severity: " + max_severity);
                    }
                })

            } catch (error) {
                return q.Signal.error([`Unable to parse alert response: ${error}`]);
            }

            if(alert_text !== '') {
                alert_text = alert_text + "<label hidden>OID:" + alert_oids + "</label>";
                const signal = new q.Signal({
                    points: [ [new q.Point(severityFormat[max_severity][0], severityFormat[max_severity][1])] ],
                    name: "NWS Alert",
                    message: alert_text,
                    isMuted: true
                });
                logger.info("Sending Signal: " + JSON.stringify(signal));

                return signal;
            } else { 
                if(typeof active_signal_id !== 'undefined') {
                    try { this.clearSignal(active_signal_id); }
                    catch(error) { logger.info('Error Clearing Signal ' + active_signal_id + ' ' + error); }
                }
                return null; }


        }
    }

}

module.exports = {
    WeatherAlerts: WeatherAlerts
}

const weatherAlerts = new WeatherAlerts();
weatherAlerts.run();