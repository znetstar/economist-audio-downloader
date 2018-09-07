const { EconomistAudioDownloader, EconomistClient } = require('../src');
const launch = require('../src/launch.js');
const winston = require('winston');
const assert = require("chai").assert;

const fs = require('fs');
const del = require('del');
const path = require('path');
const os = require('os');

require('dotenv').load();

const moment = require('moment');
const { Magic, MAGIC_MIME_TYPE } =  require('mmmagic');

const credentials = Object.freeze({ username: process.env.ECONOMIST_USERNAME, password: process.env.ECONOMIST_PASSWORD });
const proxy = (process.env.PROXY_URL || process.env.HTTP_PROXY);
const ua = process.env.USER_AGENT;
const magic = new Magic(MAGIC_MIME_TYPE);
const LOGIN_TIMEOUT = 60*1000;
const DOWNLOAD_TIMEOUT =  5 * 60 * 1000;
const EADFactory = () => new EconomistAudioDownloader(credentials, proxy, ua); 
const EconomistClientFactory = () => new EconomistClient(credentials, proxy, ua);

describe('EconomistClient', function () {
    
    describe('login(destination)', function () {
        let code_obj;
        let destination = 'audio-issue';
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
    
    describe('login()', function () {
       let client = EADFactory();
       
       it('should login successfully', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login().then((c) => code_obj = c);
        });

        it('the response should contain "code", "destination" and "state" fields', () => {
            assert.hasAllKeys(code_obj, [ "code", "destination", "state" ], "Response does not contain the required fields");
        });

        it('the destination shoud be "audio-issue"', function () {
            assert.equal("audio-issue", code_obj.destination);
        });       
    });

    let last_year_last_issue;

    describe('list_issues(year)', function() {
        let client = EADFactory();
        let issues;
        const last_year = (new Date()).getFullYear() - 1;

        before('login', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login();
        });

        it('should retrieve a list of all issues from the previous year', function () {
            return client.list_issues(last_year)
                    .then((e) => issues = e);
        });

        it('should have returned an array', function () {
            assert.isTrue(Array.isArray(issues), "Did not return an array");
        });

        it('all issues should be from last year', function () {
            assert.isTrue(
                issues.every((date) => date.substr(0, 4) === last_year.toString())
                , "Not all of the issues were from last year"
            );
        });

        it('all issues should be valid dates', function () {
            assert.isTrue(
                issues.every((date) => !Number.isNaN(new Date(date).valueOf()))
                , "Not all of issues were valid dates"
            );
        });

        after('pass last issue of last year', function () {
            last_year_last_issue = issues[issues.length - 1];
        });
    });

    describe('get_issue_page(date)', function () {
        let client = EADFactory();
        let $; 

        before('login', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login();
        });

        it("should retrieve the page for the last issue of last year", function () {
            return client.get_issue_page(last_year_last_issue)
                .then((ch) => $ = ch);
        });

        it('should contain an issue date element on the page', function () {
            assert.isAbove($('.issue-date').get().length, 0, "Page does not contain an issue date element");
        });

        it('date on the page should match the requested date', function () {
           assert.isTrue( moment($('.issue-date').text(), EconomistAudioDownloader.ISSUE_DATE_FORMAT).isSame(moment(last_year_last_issue)), "Requested date does not match date on page");
        });
    });

    describe('list_issue_sections(date)', function () {
        let client = EADFactory();
        let sections;
        before('login', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login();
        });     

        it('should retrieve a list of the sections in the last issue from last year', function () {
            return client.list_issue_sections(last_year_last_issue).then((s) => sections = s);
        });

        it('should have returned an array', function () {
            assert.isTrue(Array.isArray(sections), "Did not return an array");
        });

        it('It should have an "Introduction" section', function () {
            assert.isTrue(sections.some((i) => i === "Introduction"), 'issue did not contain an Introduction section');
        });
    });
    
    describe('download_audio_issue(date, section)', function () {
        let client = EADFactory();
        let zip_obj;

        before('login', function () {
            this.timeout(LOGIN_TIMEOUT);
            return client.login();
        });

        it('should download the "Introduction" section from the last issue of last year', function () {
            this.timeout(DOWNLOAD_TIMEOUT);
            return client.download_audio_issue(last_year_last_issue, 'Introduction')
                .then((z) => zip_obj = z);
        });

        it('should have the same issue date as requested', function () {
            assert.isTrue(moment.isSame( zip_obj.issue_date, last_year_last_issue ), "issue returned did not have the same date as requested");
        });

        it('should have returned a file with the "application/zip" mime type', function (done) {
            magic.detect(zip_obj.zip.body, (err, mime_type) => {
                if (err) return done(err);

                assert.equal("application/zip", mime_type, "Did not return a file with the correct mime type");
                done();
            });
        });
    });
});

describe('economist-audio-downloader [command] [arguments]', function () {
    const { login, download, list_issues, list_issue_sections } = launch;
    const { username, password } = credentials;
    let proxy_url = proxy;
    const nconf_factory = (obj) => require('nconf').overrides(obj);
    const logs_factory = () => winston.createLogger({ silent: true, transports: [ new (winston.transports.Console)({silent: true}) ] });

    describe('login', function () {
        let downloader = EADFactory();
        it('should successfully login', function () {
            return login(nconf_factory(), logs_factory(), downloader);
        });

        it('downloader should be logged in', function () {
            assert.isTrue(downloader.is_logged_in, "Downloader is not logged in");
        });
    });

    describe('download [date] [section] [output] [extract]', function () {
        it('should exit with a positive exit code', function () {
            return download(nconf_factory({
                extract: true,
                output: true
            }), logs_factory()).then((code) => {
                assert.isAbove(code, 0, "Exit code was not positive");
            });
        })
    });

    describe('download [issue] [section] [output]', function () {
        let tmp_dir, zip_path;
        before('create temp dir', function () {
            tmp_dir = fs.mkdtempSync("ead-test");
            zip_path = path.join(tmp_dir, "latest.zip");
        });

        it('should download the "Introduction" section of latest issue successfully and save it to a temporary path', function () {
            let nconf = nconf_factory({
                output: zip_path,
                issue: "latest",
                section: "Introduction",
                proxy_url,
                username,
                password
            });
            this.timeout(DOWNLOAD_TIMEOUT);
            return download(nconf, logs_factory()).then((code) => {
                assert.equal(0, code, "Exit code was not zero");
            });
        });

        it("the zip file should exist", function () {
            assert.isTrue(fs.existsSync(zip_path));
        });

        it("the zip file should have the zip mime type", function (done) {
            magic.detectFile(zip_path, function (err, mime_type) {
                if (err) return done(err);

                assert.equal("application/zip", mime_type, 'zip file was not "application/zip" mime');
                done();
            });
        });

        after('remove temp dir', function () { return del(path.join(tmp_dir, "**"), { force: true }); });
    });

    describe('download [issue] [section] [extract]', function () {
        let tmp_dir;
        before('create temp dir', function () {
            tmp_dir = fs.mkdtempSync("ead-test");
        });

        it('should download the "Introduction" section of latest issue successfully and save it to a temporary path', function () {
            let nconf = nconf_factory({
                extract: tmp_dir,
                issue: "latest",
                section: "Introduction",
                proxy_url,
                username,
                password
            });
            this.timeout(DOWNLOAD_TIMEOUT);
            return download(nconf, logs_factory()).then((code) => {
                assert.equal(0, code, "Exit code was not zero");
            });
        });

        it("the directory should contain files", function () {
            assert.isNotEmpty(fs.readdirSync(tmp_dir), "extract dir does not contain files");
        });

        it("the directory should contian mp3 files", function () {
            this.timeout(60000);
            const magic = new Magic(MAGIC_MIME_TYPE);

            let promises = fs.readdirSync(tmp_dir).map((localpath) => {
                let file = path.join(tmp_dir, localpath);
                return new Promise((resolve, reject) => {
                    assert.isTrue(fs.lstatSync(file).isFile(), "Directory contained non-files");

                    magic.detectFile(file, function (err, mime_type) {
                        if (err) return reject(err);
        
                        assert.equal("audio/mpeg", mime_type, "Directory did not contain mp3s");
                        resolve();
                    });
                });
            });

            return Promise.all(promises);
        });

        after('remove temp dir', function () { return del(path.join(tmp_dir, "**"), { force: true }); });
    });

    describe('list-issues year', function () {
        it('should retrieve the issues for a given year and exit with no error code', function () {
            this.timeout(60000);
            return list_issues(nconf_factory({ year: (new Date()).getFullYear(), username, password, proxy_url }), logs_factory());
        });
    });

    describe('list-issue-sections issue', function () {
        it('should retrieve the sections for a given issue and exit with no error code', function () {
            this.timeout(60000);
            return list_issue_sections(nconf_factory({ issue: 'latest', username, password, proxy_url }), logs_factory());
        });
    });
});