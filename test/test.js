const fs = require('fs');
const path = require('path');

const Promise = require('bluebird');
const winston = require('winston');
const { assert } = require("chai");
const del = require('del');
const moment = require('moment');
const launch = require('../src/launch.js');
const { Magic, MAGIC_MIME_TYPE } =  require('mmmagic');

const { EconomistAudioDownloader, EconomistClient } = require('../src');

const proxy = (process.env.PROXY_URL || process.env.HTTP_PROXY);
const ua = process.env.USER_AGENT;
const magic = new Magic(MAGIC_MIME_TYPE);
const LOGIN_TIMEOUT = 60*1000;
const DOWNLOAD_TIMEOUT =  5 * 60 * 1000;
const GLOBAL_TIMEOUT = 60 * 1000 * 3;
const EADFactory = () => new EconomistAudioDownloader(credentials, proxy, ua); 
const EconomistClientFactory = () => new EconomistClient(credentials, proxy, ua);

Promise.promisifyAll(magic);
require('dotenv').load();
const credentials = Object.freeze({ username: process.env.ECONOMIST_USERNAME, password: process.env.ECONOMIST_PASSWORD });

describe('EconomistClient', function () {
    
    describe('login(destination)', function () {
        let code_obj;
        let destination = 'audio-edition';
        let client = EconomistClientFactory();

        this.timeout(GLOBAL_TIMEOUT);

        it('should login successfully', async function () {
            this.timeout(LOGIN_TIMEOUT);
            code_obj = await client.login(destination);
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

       this.timeout(GLOBAL_TIMEOUT);
       
       it('should login successfully', async function () {
            this.timeout(LOGIN_TIMEOUT);
            code_obj = await client.login();
        });

        it('the response should contain "code", "destination" and "state" fields', () => {
            assert.hasAllKeys(code_obj, [ "code", "destination", "state" ], "Response does not contain the required fields");
        });

        it('the destination shoud be "audio-edition"', function () {
            assert.equal("audio-edition", code_obj.destination);
        });       
    });

    let last_year_last_issue;

    describe('list_issues(year)', function() {
        let client = EADFactory();
        let issues;
        const last_year = (new Date()).getFullYear() - 1;

        this.timeout(GLOBAL_TIMEOUT);

        before('login', async function () {
            this.timeout(LOGIN_TIMEOUT);
            await client.login();
        });

        it('should retrieve a list of all issues from the previous year', async function () {
            issues = await client.list_issues(last_year);
        });

        it('should have returned an array', function () {
            assert.isTrue(Array.isArray(issues), "Did not return an array");
        });

        it('all issues should be from last year', function () {
            assert.isTrue(
                issues.every((date) => new Date(date).getFullYear() === last_year)
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

        this.timeout(GLOBAL_TIMEOUT);

        before('login', async function () {
            await client.login();
        });

        it("should retrieve the page for the last issue of last year", async function () {
            $ = await client.get_issue_page(last_year_last_issue);
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

        this.timeout(GLOBAL_TIMEOUT);

        before('login', async function () {
            this.timeout(LOGIN_TIMEOUT);
            await client.login();
        });     

        it('should retrieve a list of the sections in the last issue from last year', async function () {
            sections = await client.list_issue_sections(last_year_last_issue);
        });

        it('should have returned an array', function () {
            assert.isTrue(Array.isArray(sections), "Did not return an array");
        });

        it('It should have an "Introduction" section', function () {
            assert.isTrue(sections.some((i) => i === "Introduction"), 'issue did not contain an Introduction section');
        });
    });
    
    describe('download_audio_edition(date, section)', function () {
        let client = EADFactory();
        let zip_obj;

        this.timeout(GLOBAL_TIMEOUT);

        before('login', async function () {
            this.timeout(LOGIN_TIMEOUT);
            await client.login();
        });

        it('should download the "Introduction" section from the last issue of last year', async function () {
            this.timeout(DOWNLOAD_TIMEOUT);
            zip_obj = await client.download_audio_edition(last_year_last_issue, 'Introduction');
        });

        it('should have the same issue date as requested', function () {
            assert.isTrue(moment(zip_obj.issue_date).isSame(last_year_last_issue), "issue returned did not have the same date as requested");
        });

        it('should have returned a file with the "application/zip" mime type', function (done) {
            let zip_chunks = [];
            let {zip} = zip_obj;
            zip.on('data', (buf) => {
                zip_chunks.push(buf);
            });

            zip.on('end', async () => {
                let zip_buf = Buffer.concat(zip_chunks);
                try {
                    let mime_type = await magic.detectAsync(zip_buf);
                    assert.equal("application/zip", mime_type, 'zip file was not "application/zip" mime');
                    done();
                } catch (error) {
                    done(error);
                }
            });
            
            zip.on('error', (err) => {
                done(err);
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

    describe('login', async function () {
        this.timeout(GLOBAL_TIMEOUT);
        let downloader = EADFactory();
        it('should successfully login', async function () {
            await login(nconf_factory({ username, password, proxy_url }), logs_factory(), downloader);
        });

        it('downloader should be logged in', function () {
            assert.isTrue(downloader.is_logged_in, "Downloader is not logged in");
        });
    });

    describe('download [date] [section] [output] [extract]', function () {
        this.timeout(GLOBAL_TIMEOUT);
        it('should exit with a positive exit code', async function () {
            await download([null,'latest'], nconf_factory({
                extract: true,
                output: true
            }), logs_factory()).then((code) => {
                assert.isAbove(code, 0, "Exit code was not positive");
            });
        })
    });

    describe('download [issue] [section] [output]', function () {
        this.timeout(GLOBAL_TIMEOUT);
        let tmp_dir, zip_path;
        before('create temp dir', function () {
            tmp_dir = fs.mkdtempSync("ead-test");
            zip_path = path.join(tmp_dir, "latest.zip");
        });

        it('should download the "Introduction" section of latest issue successfully and save it to a temporary path', async function () {
            let nconf = nconf_factory({
                output: zip_path,
                issue: "latest",
                section: "Introduction",
                proxy_url,
                username,
                password
            });
            this.timeout(DOWNLOAD_TIMEOUT);
            await download([null, 'latest'], nconf, logs_factory()).then((code) => {
                assert.equal(0, code, "Exit code was not zero");
            });
        });

        it("the zip file should exist", function () {
            assert.isTrue(fs.existsSync(zip_path));
        });

        it("the zip file should have the zip mime type", async function () {
            let mime_type = await magic.detectFileAsync(zip_path);

            assert.equal("application/zip", mime_type, 'zip file was not "application/zip" mime');
        });

        after('remove temp dir', async function () { await del(path.join(tmp_dir, "**"), { force: true }); });
    });

    describe('download [issue] [section] [extract]', function () {
        this.timeout(GLOBAL_TIMEOUT);
        let tmp_dir;
        before('create temp dir', function () {
            tmp_dir = fs.mkdtempSync("ead-test");
        });

        it('should download the "Introduction" section of latest issue successfully and save it to a temporary path', async function () {
            let nconf = nconf_factory({
                extract: tmp_dir,
                section: "Introduction",
                proxy_url,
                username,
                password
            });
            this.timeout(DOWNLOAD_TIMEOUT);
            await download([null, "latest"], nconf, logs_factory()).then((code) => {
                assert.equal(0, code, "Exit code was not zero");
            });
        });

        it("the directory should contain files", function () {
            assert.isNotEmpty(fs.readdirSync(tmp_dir), "extract dir does not contain files");
        });

        it("the directory should contian mp3 files", async function () {
            this.timeout(60000);

            let promises = fs.readdirSync(tmp_dir).map(async (localpath) => {
                let file_path = path.join(tmp_dir, localpath);

                assert.isTrue(fs.lstatSync(file_path).isFile(), "Directory contained non-files");

                let mime_type = await magic.detectFileAsync(file_path);
                assert.equal("audio/mpeg", mime_type, "Directory did not contain mp3s");
            });

            await Promise.all(promises);
        });

        after('remove temp dir', async function () { await del(path.join(tmp_dir, "**"), { force: true }); });
    });

    describe('list-issues year', function () {
        this.timeout(GLOBAL_TIMEOUT);
        it('should retrieve the issues for a given year and exit with no error code', async function () {
            this.timeout(60000);
            await list_issues([null, (new Date()).getFullYear()], nconf_factory({ username, password, proxy_url }), logs_factory());
        });
    });

    describe('list-issue-sections issue', function () {
        this.timeout(GLOBAL_TIMEOUT);
        it('should retrieve the sections for a given issue and exit with no error code', async function () {
            this.timeout(60000);
            await list_issue_sections([null, 'latest'], nconf_factory({ username, password, proxy_url }), logs_factory());
        });
    });
});