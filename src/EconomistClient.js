const request = require('request-promise-any');
const ProxyAgent = require('proxy-agent');
const cheerio = require('cheerio');

const Auth0FieldEncoder = require('./Auth0FieldEncoder');

/**
 * Default user agent to be used with each request.
 * 
 * @constant 
 * @type {string}
 * @default
 */
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36';

/**
 * The domain for the authentication endpoints.
 * 
 * @constant 
 * @type {string}
 * @default
 */
const AUTH_DOMAIN = 'https://authenticate.economist.com';

/**
 * Returns a {@link https://bit.ly/2hVpK3n|cheerio} object (`$`) for the given HTML.
 * @param {string} body - The body of the HTTP response.
 * @returns {any} - {@link https://bit.ly/2hVpK3n|cheerio} object.
 * @private
 */
function cheerio_transform (body) { return cheerio.load(body); }
const qs = require('qs');
const url = require('url');
const _ =  require('lodash');

/**
 * Default form that will be POSTed during login.
 * @constant
 * @default
 * @type {object}
 */
const LOGIN_FORM_BASE = Object.freeze({
	"tenant": "theeconomist",
	"_intstate": "deprecated",
	"connection": "Drupal"
});

/**
 * Parses the query string of a url and returns an object
 * @param {string} u - URL to parse
 * @returns {object} - Object with query string keys and values
 * @private
 */
function qs_parse (u) { return qs.parse(url.parse(u).query); }

/**
 * This object contains the credentials for logging into the economist.com website.
 * @typedef {Object} Credentials
 * @property {string} username - The emaill address of the economist.com account.
 * @property {string} password - The password of the economist.com account.
 */

/**
 * The class contains methods for interacting with economist.com.
 * 
 */
class EconomistClient {
    /**
     * Creates an `EconomistClient` instance.
     * @param {Credentials} credentials - The credentials for the economist.com account. 
     * @param {string} [proxy_url] - The URL to a proxy to use for all requests. Is passed to {@link https://bit.ly/2Qz8vSj|proxy-agent}.
     * @param {string} [user_agent=DEFAULT_USER_AGENT] - The User-Agent to use for all requests.
     * @param {CookieJar} [cookie_jar] - A {@link https://bit.ly/2NfUWcs|tough-cookie} compatible CookieJar to use for all requests.
     */
    constructor(credentials, proxy_url, user_agent, cookie_jar) {
        /**
         * The credentials for the economist.com account. 
         * @type {Credentials}
         */
        this.credentials = credentials;
        /**
         * The agent for each request.
         * @type {any}
         */
        this.agent = proxy_url ? new ProxyAgent(proxy_url) : void(0);
        /**
         * The headers for each request.
         * @type {Object}
         */
        this.headers = {
            'User-Agent': user_agent || DEFAULT_USER_AGENT
        };
        /**
         * The `request.jar()` store of cookies for each request
         * @type {RequestJar}
         */
        this.jar = request.jar(cookie_jar);
         /**
         * The {@link https://bit.ly/2MAgZVU|request-promise-any} instance for each request.
         * @type {Object}
         */       
        this.request = request.defaults({
            jar: this.jar,
            agent: this.agent,
            headers: this.headers
        });
    }

    /**
     * Indicates if the user is logged in.
     * @returns {boolean}
     */
    get is_logged_in() {
        return Boolean(this.login_result);
    }

    /**
     * This object is returned by economist.com after successfully logging in.
     * 
     * @typedef {Object} LoginResponse
     * @property {string} state
     * @property {string} code - An access token of some sort.
     * @property {string} destination - Where to redirect to after logging in.
     */

    /**
     * Signs into the economist.com account with the provided credentials.
     * @param {string} [destination] - What section of the site to return to after logging in.
     * @returns {Promise<LoginResponse>}
     * @async
     */
    async login(destination) {
        let user_page_response = await this.request({
            url: "https://www.economist.com/user/login",
            qs: {
                destination
            },
            resolveWithFullResponse: true,
            followRedirect: false,
            simple: false
        });
        
        let authorize_url = user_page_response.headers['location'];

        let { client_id, redirect_uri, response_type, prompt, scope } = qs_parse(authorize_url);

        let authorize_response = await this.request({
            url: authorize_url,
            resolveWithFullResponse: true,
            followRedirect: false,
            simple: false
        });

        let login_page_url = AUTH_DOMAIN + authorize_response.headers['location'];

        let { state } = qs_parse(login_page_url);

        let login_page_resp = await this.request({ url: login_page_url, resolveWithFullResponse: true });
        let login_page_body = login_page_resp.body;

        let telemetryData = { name: 'auth0.js', version: login_page_body.split('e.exports={raw:"').pop().split('"').shift() };

        let cookies = this.jar.getCookies(AUTH_DOMAIN+'/usernamepassword/login');
        let _csrf = cookies.filter((c) => c.key === '_csrf')[0].value;

        let login_form = _.extend(_.clone(LOGIN_FORM_BASE), { 
            _csrf, 
            state, 
            client_id,
            redirect_uri,
            scope,
            response_type,
            username: this.credentials.username, 
            password: this.credentials.password
        });

        let auth_0_client = Auth0FieldEncoder.encode(JSON.stringify(telemetryData));
        
        let $ = await this.request({
            url: AUTH_DOMAIN+'/usernamepassword/login',
            body: JSON.stringify(login_form),
            transform: cheerio_transform,
            method: "POST",
            headers: _.extend(_.clone(this.headers), {
                "Auth0-Client": auth_0_client,
                Referer: login_page_url,
                'Content-Type': 'application/json'
            })
        });

        let jwt_form = {};
        $('form[name="hiddenform"] input[name]').get().forEach((element) => jwt_form[$(element).attr('name')] = $(element).val());

       let login_callback_resp = await this.request({
            url: AUTH_DOMAIN+'/login/callback',
            form: jwt_form,
            followRedirect: false,
            resolveWithFullResponse: true,
            simple: false,
            method: "POST",
            headers: _.extend(_.clone(this.headers), {
                'Upgrade-Insecure-Requests': 1,
                Referer: login_page_url,
                Origin: AUTH_DOMAIN
            })
        });

        let success_url = login_callback_resp.headers['location'];
        /**
         * The login response.
         *  
         * @type {LoginResponse}
         */
        this.login_result = qs_parse(success_url);

        await this.request({ url: success_url });
        
        return this.login_result;
    }
}

/**
 * This module contains the {@link EconomistClient} class
 * @module economist-audio-downloader/EconomistClient
 */
module.exports = EconomistClient;