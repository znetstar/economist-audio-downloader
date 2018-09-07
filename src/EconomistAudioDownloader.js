const request = require('request-promise-any');
const EconomistClient = require('./EconomistClient');
const moment = require('moment');
const cheerio = require('cheerio');
const cheerio_transform = (body) => cheerio.load(body);

class EconomistAudioDownloader extends EconomistClient {
    constructor(credentials, proxy_uri, user_agent, cookie_jar) {
        super(credentials, proxy_uri, user_agent, cookie_jar);
    }

    static get ISSUE_DATE_FORMAT() { return "MMMM Do, YYYY"; }

    async login() {
        return await super.login('audio-edition');
    }

    async list_issues(year) {
        if (!this.login_result || this.login_result.destination !== 'audio-edition') throw new Error("Not logged in.");

        year = year || (new Date()).getFullYear();

        let $ = await this.request({
            url: `https://www.economist.com/audio-edition/covers?date_filter[value][year]=${year}`,
            transform: cheerio_transform
        });

        return $('.audio-cover-image a').get().map((e) => moment($(e).attr('href').split('/').pop())._d);
    }

    async get_issue_page(date) {
        if (!this.login_result || this.login_result.destination !== 'audio-edition') throw new Error("Not logged in.");

        let issue_date = date && date !== 'latest' ? moment(date).format('YYYY-MM-DD') : 'latest';

        return await this.request({
            url: `https://www.economist.com/audio-edition/${issue_date}`,
            transform: cheerio_transform
        });
    }

    async list_issue_sections(date) {
        let $ =  await this.get_issue_page(date);

        return $('.audio-sections a').get().map((e) => { let section = $(e).attr('href').split('_The_Economist_').pop().split('_'); section.shift(); section = section.join('_').split('.').shift(); return section; });
    }

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

        return { zip: zip_resp, issue_date: moment($('.issue-date').text(), EconomistAudioDownloader.ISSUE_DATE_FORMAT)._d };
    }
}

module.exports = EconomistAudioDownloader;