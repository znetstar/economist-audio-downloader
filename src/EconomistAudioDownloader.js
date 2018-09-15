const moment = require('moment');
const cheerio = require('cheerio');

const EconomistClient = require('./EconomistClient');

/**
 * Returns a {@link https://bit.ly/2hVpK3n|cheerio} object (`$`) for the given HTML.
 * @param {string} body - The body of the HTTP response.
 * @returns {any} - {@link https://bit.ly/2hVpK3n|cheerio} object.
 * @private
 */
function cheerio_transform (body) { return cheerio.load(body); }

/**
 * The format of the issue date on economist.com
 * @constant
 * @type {sring}
 * @default
 */
const ISSUE_DATE_FORMAT = "MMMM Do, YYYY";

/**
 * This class contains methods for obtaining audio downloads of the Economist publication.
 * 
 * @extends EconomistClient
 */
class EconomistAudioDownloader extends EconomistClient {
    /**
     * Creates an `EconomistClient` instance
     * @param {Credentials} credentials - The credentials for the economist.com account. 
     * @param {string} [proxy_url] - The URL to a proxy to use for all requests. Is passed to {@link https://bit.ly/2Qz8vSj|proxy-agent}.
     * @param {string} [user_agent=DEFAULT_USER_AGENT] - The User-Agent to use for all requests.
     * @param {CookieJar} [cookie_jar] - A {@link https://bit.ly/2NfUWcs|tough-cookie} compatible CookieJar to use for all requests.
     */
    constructor(credentials, proxy_uri, user_agent, cookie_jar) {
        super(credentials, proxy_uri, user_agent, cookie_jar);
    }
    
    /**
     * {@link ISSUE_DATE_FORMAT}
     * @static
     * @type {String}
     */
    static get ISSUE_DATE_FORMAT () { return ISSUE_DATE_FORMAT; }

    /**
     * Signs in to economist.com and asks to be redirected to the "audio-edition" page.
     * 
     * @returns {Promise<LoginResponse>}
     * @async
     */
    async login() {
        return await super.login('audio-edition');
    }

    /**
     * Lists issues for a specific year.
     * @param {string|number} [year=new Date().getFullYear()]
     * @returns {Promise<Date[]>}
     * @async 
     */
    async list_issues(year) {
        if (!this.login_result || this.login_result.destination !== 'audio-edition') throw new Error("Not logged in.");

        year = year || (new Date()).getFullYear();

        let $ = await this.request({
            url: `https://www.economist.com/audio-edition/covers?date_filter[value][year]=${year}`,
            transform: cheerio_transform
        });

        return $('.audio-cover-image a').get().map((e) => moment($(e).attr('href').split('/').pop())._d);
    }

    /**
     * Returns a {@link https://bit.ly/2hVpK3n|cheerio} object for the page of a specific issue. 
     * @param {string|number} [date="latest"] - The date the issue was released. Can be a `Date`, or anything parsable by moment {@link https://bit.ly/2QvZPMp|moment} or will default to the latest issue.
     * @returns {Promise<any>} - The {@link https://bit.ly/2hVpK3n|cheerio} object.
     * @private 
     * @async 
     */
    async get_issue_page(date) {
        if (!this.login_result || this.login_result.destination !== 'audio-edition') throw new Error("Not logged in.");

        let issue_date = date && date !== 'latest' ? moment(date).format('YYYY-MM-DD') : 'latest';

        return await this.request({
            url: `https://www.economist.com/audio-edition/${issue_date}`,
            transform: cheerio_transform
        });
    }

    /**
     * Returns all of the sections of an issue (Introduction, Obituary, Business, etc.). THe sections will be listed in the order the appear in the publication.
     * @param {string|number|Date} [date="latest"] - The date the issue was released. Can be a `Date`, or anything parsable by moment {@link https://bit.ly/2QvZPMp|moment} or will default to the latest issue.
     * @returns {Promise<string[]>}
     * @async 
     */
    async list_issue_sections(date) {
        let $ =  await this.get_issue_page(date);

        return $('.audio-sections a').get().map((e) => { let section = $(e).attr('href').split('_The_Economist_').pop().split('_'); section.shift(); section = section.join('_').split('.').shift(); return section; });
    }

    /**
     * Contains the zip file with mp3s and the date the issue was released on.
     * 
     * @typedef {Object} AudioEdition
     * @property {ClientResponse} zip - The HTTP response of the zip file containing one or more mp3 files.
     * @property {Date} issue_date - The date the issue was released on.
     */

    /**
     * Returns audio edition of a given issue or section of an issue.
     * @param {string|number|Date} [date="latest"] - The date the issue was released. Can be a `Date`, or anything parsable by moment {@link https://bit.ly/2QvZPMp|moment} or will default to the latest issue.
     * @param {string|number} [section] - Either the name or number of the section of the issue to download (e.g. `Introduction` or `01`). If not provided will download the entire issue.
     * @returns {Promise<AudioEdition>}
     * @async 
     */
    async download_audio_edition(date, section) {
        let $ = await this.get_issue_page(date);

        let zip_url;
        if (section) {
            section = typeof(section) === 'number' ? (section < 10 ? '0'+section : section) : section;
            let matches = $(`.audio-sections a[href*="${section}"]`).get();
            if (!matches) throw new Error('Invalid section number');

            zip_url = $(matches[0]).attr('href');
        } else {
            zip_url = $('.audio-issue-full-download-link a').attr('href');
        }

        let zip_resp = require('request')({
            url: zip_url,
            encoding: null,
            jar: this.jar,
            agent: this.agent,
            headers: this.headers
        });

        return { zip: zip_resp, issue_date: moment($('.issue-date').text(), ISSUE_DATE_FORMAT)._d };
    }
};

/**
 * This module contains the {@link EconomistAudioDownloader} class.
 * @module economist-audio-downloader/EconomistAudioDownloader
 */
module.exports = EconomistAudioDownloader;