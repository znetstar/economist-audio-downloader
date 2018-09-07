const { EconomistAudioDownloader, EconomistClient } = require('../src');
const assert = require("chai").assert;

require('dotenv').load();

const credentials = Object.freeze({ username: process.env.ECONOMIST_USERNAME, password: process.env.ECONOMIST_PASSWORD });
const proxy = (process.env.PROXY_URL || process.env.HTTP_PROXY);
const ua = process.env.USER_AGENT;

describe('EconomistClient', function () {
    const EconomistClientFactory = () => new EconomistClient(credentials, proxy, ua);
    describe('login', function () {
        let access_token;
        let client = EconomistClientFactory();

        it('should login successfully and return an "access_token"', function () {
            return client.login().then((at) => {
                access_token = at;
            });
        });
    });
});

describe('EconomistAudioDownloader', function () {
    const EADFactory = () => new EconomistAudioDownloader(credentials, proxy, ua); 
});