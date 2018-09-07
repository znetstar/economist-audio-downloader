const request = require('request-promise-any');
const ProxyAgent = require('proxy-agent');
const cheerio = require('cheerio');

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36';
const AUTH_DOMAIN = 'https://authenticate.economist.com';
const USER_PAGE_URL = 'https://www.economist.com/user/login?destination=audio-edition';
const cheerio_transform = (body) => cheerio.load(body);
const qs = require('qs');
const url = require('url');
const _ =  require('lodash');

const login_form_base = Object.freeze({
	"tenant": "theeconomist",
	"_intstate": "deprecated",
	"connection": "Drupal"
});

const qs_parse = (u) => qs.parse(url.parse(u).query);

const Auth0FieldEncoder = {
    l: Object.freeze(["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9","+","/"]),
    c: function (e,t,n) {
        let { l } = Auth0FieldEncoder;
        for (var r, o = [], i = t; i < n; i += 3)
            r = (e[i] << 16 & 16711680) + (e[i + 1] << 8 & 65280) + (255 & e[i + 2]),
            o.push(l[(a = r) >> 18 & 63] + l[a >> 12 & 63] + l[a >> 6 & 63] + l[63 & a]);
        var a;
        return o.join("")
    },
    t: function (e) {
        let { c, l } = Auth0FieldEncoder;
        for (var t, n = e.length, r = n % 3, o = "", i = [], a = 0, s = n - r; a < s; a += 16383)
            i.push(c(e, a, s < a + 16383 ? s : a + 16383));
        return 1 === r ? (t = e[n - 1],
        o += l[t >> 2],
        o += l[t << 4 & 63],
        o += "==") : 2 === r && (t = (e[n - 2] << 8) + e[n - 1],
        o += l[t >> 10],
        o += l[t >> 4 & 63],
        o += l[t << 2 & 63],
        o += "="),
        i.push(o),
        i.join("")
    },
    encode: function (e) {
        let { t } = Auth0FieldEncoder;
        return t(function(e) {
            for (var t = new Array(e.length), n = 0; n < e.length; n++)
                t[n] = e.charCodeAt(n);
            return t
        }(e)).replace(/\+/g, "-").replace(/\//g, "_")
    }
};

class EconomistClient {
    constructor(credentials, proxy_url, user_agent, cookie_jar) {
        this.credentials = credentials;
        let agent = this.agent = proxy_url ? new ProxyAgent(proxy_url) : void(0);
        let headers = this.headers = {
            'User-Agent': user_agent || DEFAULT_USER_AGENT
        };
        let jar = this.jar = request.jar(cookie_jar);
        this.request = request.defaults({
            jar,
            agent,
            headers
        });
    }

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

        let login_form = _.extend(_.clone(login_form_base), { 
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

        await this.request({ url: success_url });

        return qs_parse(success_url);
    }
}

module.exports = EconomistClient;