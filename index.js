const q = require('daskeyboard-applet');
const request = require('request-promise');
const apiUrl = "https://api.weather.gov";
const logger = q.logger;



async function downloadAlerts(zone) {
    const url = apiUrl + "/alerts/active?zone=" + zone;
    console.log("Downloading alerts from " + url);

    headers = { 'User-Agent': 'request(q-applet-weather)',
                'Accept': 'application/json' };

    return request.get({
        url: url,
        headers: headers,
        json: true
        }).then(body => {
            return body;
        }).catch((error) => {
        console.log('Error when trying to getForecast', error);
        throw new Error('Error when trying to getForecast: ', error);
        })
}

function compareSeverity(currentSev, newSeverity) {
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
        console.log("Error matching severity ", $newSeverity, ": ", error);
    }
}



class WeatherAlerts extends q.DesktopApp {
    constructor() {
        super();
        this.zoneName = null;
        // run every 15 min
        //this.pollingInterval = 15 * 60 * 1000;
        this.pollingInterval = 60;
    }


    async run() {
        logger.info("Weather Alerts running.");
        var maxSeverity = 'Unknown';
        var alertText = '';
        //const zoneId=this.config.zoneId;
        const zoneId = 'AKZ222'

        // const severityFormat = { 'Extreme': [this.config.colorExtreme, 'BLINK'],
        //                         'Severe':   [this.config.colorSevere, 'BLINK'],
        //                         'Moderate': [this.config.colorModerate, 'SET_COLOR'],
        //                         'Minor':    [this.config.colorMinor, 'SET_COLOR'],
        //                         'Unknown':  [this.config.colorUnknown, 'SET_COLOR'] };

        const severityFormat = { 'Extreme': '#FF0000',
                                'Severe':   '#FFA500',
                                'Moderate': '#00FF00',
                                'Minor':    '#00FF00',
                                'Unknown':  '#00FFFF'};

        if (!zoneId) {
            logger.info('No zoneId configured');
            return null;        
        } else {
            logger.info("My zone ID is  : " + zoneId);

            return downloadAlerts(zoneId).then(alertjson => {
                //logger.info(alertjson+"\n\nEnd message______________\n");
                try {
                    const features = alertjson.features;
                    logger.info("Parsing Response Length " + alertjson.features.length);
                    features.forEach(alert => {
                        //console.log("\n---------\n" + alert);
                        //logger.info('Alert: ', alert.properties.id);
                        maxSeverity = compareSeverity(maxSeverity, alert.properties.severity);
                        //alertText = "<div><b>" + alert.properties.headline + "</b></div>";
                        alertText = "<div><b>Severity: " + alert.properties.severity + "</b><div>";
                        alertText = alertText + "<div>" + alert.properties.description + "</div>";
                        //alert.properties.instruction ? alertText = alertText + "<div>" + alert.properties.instruction + "</div>" : {};
                        //logger.info(alertText, "\n\n");
                        const signal = new q.Signal({
                            points: new q.Point(severityFormat[maxSeverity]),
                            name: alert.properties.headline,
                            message: alertText,
                            isMuted: false
                        });
                        logger.info('Sending signal: ' + JSON.stringify(signal));
                        return signal;
                    })
                } catch (error) {
                    logger.info("Unable to parse alert response: ", error," Payload: ", alertjson);
                    return null;
                }
                //logger.info("Max Severity: ", maxSeverity);
            
            }).catch((error) => {
                logger.info("Error trying to parse forecast: ", error);
                throw new Error("Error trying to parse forecast: ", error);
            });

        }
    }

}

module.exports = {
    downloadAlerts: downloadAlerts,
    compareSeverity: compareSeverity,
    WeatherAlerts: WeatherAlerts
}

const WeatherAlert = new WeatherAlerts();