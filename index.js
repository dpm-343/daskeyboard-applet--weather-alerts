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

    outputTest(){
        return "Severe";
    }

    async run() {
        logger.info("Weather Alerts running.");
        var maxSeverity = 'Unknown';
        var alertText = '';
        var alertHeadline = '';
        //const zoneId=this.config.zoneId;
        const zoneId = 'MIZ022';

        const severityFormat = { 'Extreme': [this.config.colorExtreme, 'BLINK'],
                                'Severe':   [this.config.colorSevere, 'BLINK'],
                                'Moderate': [this.config.colorModerate, 'BLINK'],
                                'Minor':    [this.config.colorMinor, 'SET_COLOR'],
                                'Unknown':  [this.config.colorUnknown, 'SET_COLOR'] };

        // const severityFormat = { 'Extreme': "#FF0000",
        //                          'Severe':   "#FFA500",
        //                          'Moderate': "#00FF00",
        //                          'Minor':    "#00FF00",
        //                          'Unknown':  "#00FFFF" };

        if (!zoneId) {
            logger.info('No zoneId configured');
            return null;        
        } else {
            logger.info("My zone ID is  : " + zoneId);

            const alertjson = await this.downloadAlerts(zoneId);
            logger.info("Received Alert" + JSON.stringify(alertjson));
            try {
                const features = alertjson.features;
                logger.info("Parsing Response Length " + alertjson.features.length);
                features.forEach(alert => {
                    logger.info('Alert: ' + alert.properties.id);
                    maxSeverity = this.compareSeverity(maxSeverity, alert.properties.severity);
                    alertText = alertText + "<div><b>" + alert.properties.headline + "</b></div>";
                    alertText = alertText + "<div><b>Severity: " + alert.properties.severity + "</b><div>";
                    alertText = alertText + "<div>" + alert.properties.description + "</div>";
                    //alert.properties.instruction ? alertText = alertText + "<div>" + alert.properties.instruction + "</div>" : {};

                    logger.debug(alertText, "\n\n");
                    logger.info("MaxSeverity: " + maxSeverity);

                })
                if(alertText) {
                    const signal = new q.Signal({
                        points: [ [new q.Point(severityFormat[maxSeverity][0], severityFormat[maxSeverity][1])] ],
                        name: "NWS Alert",
                        message: alertText,
                        isMuted: false
                    });
                    logger.info("Sending Signal: " + JSON.stringify(signal));
                    return signal;
                } else { return null; }
            } catch (error) {
                return q.Signal.error([`Unable to parse alert response: ${error}`]);
            }


        }
    }

}

module.exports = {
    WeatherAlerts: WeatherAlerts
}

const weatherAlerts = new WeatherAlerts();