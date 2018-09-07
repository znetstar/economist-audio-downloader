const request = require('request-promise-any');
const EconomistClient = require('./EconomistClient');

class EconomistAudioDownloader extends EconomistClient {
    constructor(credentials, proxy_uri, user_agent, cookie_jar) {
        super(credentials, proxy_uri, user_agent, cookie_jar);
    }
}

module.exports = EconomistAudioDownloader;