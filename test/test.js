const { EconomistAudioDownloader, EconomistClient } = require('../src');
const assert = require("chai").assert;

require('dotenv').load();

const credentials = Object.freeze({ username: process.env.ECONOMIST_USERNAME, password: process.env.ECONOMIST_PASSWORD });
const proxy = (process.env.PROXY_URL || process.env.HTTP_PROXY);
const ua = process.env.USER_AGENT;
const LOGIN_TIMEOUT = 60*1000;
const moment = require('moment');

describe('EconomistClient', function () {
    const EconomistClientFactory = () => new EconomistClient(credentials, proxy, ua);
    describe('login(destination)', function () {
        let code_obj;
        let destination = 'audio-edition';
        let client = EconomistClientFactory();

        it('should login successfully', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login(destination).then((c) => code_obj = c);
        });

        it('the response should contain "code", "destination" and "state" fields', () => {
            assert.hasAllKeys(code_obj, [ "code", "destination", "state" ], "Response does not contain the required fields");
        });

        it('the destination shoud be the same as the request', function () {
            assert.equal(destination, code_obj.destination);
        });
    });
});

describe('EconomistAudioDownloader', function () {
    const EADFactory = () => new EconomistAudioDownloader(credentials, proxy, ua); 

    describe('login()', function () {
       let client = EADFactory();
       
       it('should login successfully', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login().then((c) => code_obj = c);
        });

        it('the response should contain "code", "destination" and "state" fields', () => {
            assert.hasAllKeys(code_obj, [ "code", "destination", "state" ], "Response does not contain the required fields");
        });

        it('the destination shoud be "audio-edition"', function () {
            assert.equal("audio-edition", code_obj.destination);
        });       
    });

    let last_year_last_edition;

    describe('list_editions(year)', function() {
        let client = EADFactory();
        let editions;
        let last_year = (new Date()).getFullYear() - 1;

        before('login', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login();
        });

        it('should retrieve a list of all editions from the previous year', function () {
            return client.list_editions(last_year)
                    .then((e) => editions = e);
        });

        it('should have returned an array', function () {
            assert.isTrue(Array.isArray(editions), "Did not return an array");
        });

        it('all editions should be from last year', function () {
            assert.isTrue(
                editions.every((date) => date.substr(0, 4) === last_year.toString())
                , "Not all of the editions were from last year"
            );
        });

        it('all editions should be valid dates', function () {
            assert.isTrue(
                editions.every((date) => !Number.isNaN(new Date(date).valueOf()))
                , "Not all of editions were valid dates"
            );
        });

        after('pass last edition of last year', function () {
            last_year_last_edition = editions.slice(-1)[0];
        });
    });

    describe('get_edition_page(date)', function () {
        let client = EADFactory();
        let $; 

        before('login', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login();
        });

        it("should retrieve the page for the last edition of last year", function () {
            return client.get_edition_page(last_year_last_edition)
                .then((ch) => $ = ch);
        });

        it('should contain an issue date element on the page', function () {
            assert.isAbove($('.issue-date').get().length, 0, "Page does not contain an issue date element");
        });

        it('date on the page should match the requested date', function () {
           assert.isTrue( moment($('.issue-date').text(), "MMMM Do, YYYY").isSame(moment(last_year_last_edition)), "Requested date does not match date on page");
        });
    });

    describe('list_edition_sections(date)', function () {
        let client = EADFactory();
        let sections;
        before('login', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login();
        });     

        it('should retrieve a list of the sections in the last edition from last year', function () {
            return client.list_edition_sections(last_year_last_edition).then((s) => sections = s);
        });

        it('should have returned an array', function () {
            assert.isTrue(Array.isArray(sections), "Did not return an array");
        });

        it('It should have an "Introduction" section', function () {
            assert.isTrue(sections.some((i) => i === "Introduction"), 'Edition did not contain an Introduction section');
        });
    });
    
    describe('download_audio_edition(date, section)', function () {
        let client = EADFactory();
        let zip;

        before('login', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login();
        });

        it('should download the "Introduction" section from the last edition of last year', function () {
            this.timeout( 5 * 60 * 1000 );
            return client.download_audio_edition(last_year_last_edition, 'Introduction')
                .then((z) => zip = z);
        });
    });
});