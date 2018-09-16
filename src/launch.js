
const path = require('path');
const fs = require('fs');

const {Provider} = require('nconf');
const winston = require('winston');
const unzip = require('unzip');
const fstream = require('fstream');
const moment = require('moment');

const { EconomistAudioDownloader } = require('./');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), 'utf8'));

var logs, nconf;

/**
 * The environment variables that can be used to configure the application.
 * @type {string[]}
 * @constant
 * @default
 */
const env_whitelist = [
    "LOG_LEVEL",
    "ECONOMIST_USERNAME",
    "ECONOMIST_PASSWORD",
    "USERNAME",
    "USER_AGENT",
    "PASSWORD",
    "PROXY_URL",
    "HTTP_PROXY"
];

/**
 * Converts a configuration property's name from env variable format to application config format
 * `"CONTROL_HOST"` -> `"controlHost"` 
 * @param {string} env - Environment variable
 * @returns {string}
 * @private
 */
function env_to_config(env) {
	let a = env.toLowerCase().split('_');
	i = 1;
	while (i < a.length) {
		a[i] = a[i][0].toUpperCase() + a[i].substr(1);
		i++;
	}
	return a.join('');
 }


/**
 * Creates an {@link EconomistAudioDownloader} instance with the application configuration.
 * @param {Provider} nconf - Nconf instance to use.
 * @returns {EconomistAudioDownloader}
 * @private
 */
function EADFactory(nconf) {
    return new EconomistAudioDownloader({ username: nconf.get('username'), password: nconf.get('password') }, nconf.get('proxyUrl'), nconf.get('userAgent'));
}

/**
 * Used by all commands to log into the user account.
 * @param {Provider} nconf - The nconf instance.
 * @param {Logger} logs - The winston logger.
 * @param {EconomistAudioDownloader} downloader - The `EconomistAudioDownloader` instance.
 * @async
 * @returns {Promise<number>} - Returns the exit code.
 */
async function login(nconf, logs, downloader) {
    if (!nconf.get('username') || !nconf.get('password')) {
        logs.silent = false;
        logs.error("No username and/or password given");
        return 1;
    }
    logs.debug(`Logging in to user ${downloader.credentials.username}`);
    try {
        await downloader.login();
        return 0;
    }
    catch (error) {
        logs.silent = false;
        logs.error(`An error occured logging in: ${error.message}`);
        return 1;
    }

}

/**
 * Lists issues in a year
 * @param {Provider} nconf - The nconf instance.
 * @param {Logger} logs - The winston logger.
 * @async
 * @returns {Promise<number>} - Returns the exit code.
 */
async function list_issues(argv, nconf, logs) {
    let downloader = EADFactory(nconf);

    let year = argv[1];

    let login_code = await login(nconf, logs, downloader);
    if (login_code > 0) return login_code;
    
    try {
        let issues = await downloader.list_issues(year);
        console.log(issues.map((d) => moment(d).format("YYYY-MM-DD")).join("\n"));
        return 0;
    } catch (error) {
        logs.error(`Error getting issues for ${year}: ${error.message}`);
        return 1;
    }
}

/**
 * Lists sections in an issue
 * @param {Provider} nconf - The nconf instance.
 * @param {Logger} logs - The winston logger.
 * @async
 * @returns {Promise<number>} - Returns the exit code.
 */
async function list_issue_sections(argv, nconf, logs) {
    let downloader = EADFactory(nconf);

    let login_code = await login(nconf, logs, downloader);
    if (login_code > 0) return login_code;

    let issue = argv[1];
    
    try {
        let sections = await downloader.list_issue_sections(issue);
        console.log(sections.join("\n"));
        return 0;
    } catch (error) {
        logs.error(`Error getting issues for ${issue}: ${error.message}`);
        return 1;
    }
}

/**
 * Downloads an issue writing either to a file or stdout.
 * @param {Provider} nconf - The nconf instance.
 * @param {Logger} logs - The winston logger.
 * @async
 * @returns {Promise<number>} - Returns the exit code.
 */
async function download(argv, nconf, logs) {
    let downloader = EADFactory(nconf);

    let date = argv[1] || 'latest';

    let section = nconf.get('section');
    let sectStr = section ? " section \"" + section + "\"" : "";

    let output = nconf.get('output');
    let extract = nconf.get('extract');
    

    if (output && extract) {
        logs.error("Cannot download and extract");
        return 1;
    }

    if (!(nconf.get('output') || nconf.get('extract')))
        logs.silent = true;

    let login_code = await login(nconf, logs, downloader);
    if (login_code > 0) return login_code;

    if (extract || output)
        logs.info(`Downloading audio for issue "${date}"${ sectStr }`);
    try {
        let { zip, issue_date } = await downloader.download_audio_edition(date, section);
        
        return new Promise((resolve) => {
            if (output) {
                let out = zip.pipe(fs.createWriteStream(output));

                out.on('finish', () => {
                    logs.info(`Successfully wrote "${date}"${sectStr} to "${output}"`);
                    resolve(0);
                })

                out.on('error', (err) => {
                    logs.silent = false;
                    logs.error(`Error writing to "${output}": ${err.mesage}`);
                    resolve(1);
                });  
            } else if (extract) {
                try {
                    if (!fs.existsSync(extract))
                        fs.mkdirSync(extract);

                    let subdir = nconf.get('subdir');
                    if (subdir) {
                        extract = path.join(extract, moment(issue_date).format("YYYY-MM-DD"));
                        if (!fs.existsSync(extract))
                            fs.mkdirSync(extract);
                    }

                    let out = zip
                        .pipe(unzip.Parse())
                        .pipe(fstream.Writer(extract));

                    out.on('close', () => {
                        logs.info(`Successfully extracted "${date}"${sectStr} to "${extract}"`);
                        resolve(0);
                    })

                    out.on('error', (err) => {
                        logs.silent = false;
                        logs.error(`Error extracting to "${extract}": ${err.mesage}`);
                        resolve(1);
                    });  
                } catch (err) {
                    logs.silent = false;
                    logs.error(`Error extracting to "${extract}": ${err.mesage}`);
                    resolve(1);
                }
            } else { // Stdout
                let out = zip.pipe(process.stdout)
                out.on('finish', () => {
                    resolve(0);
                })

                out.on('error', (err) => {
                    logs.silent = false;
                    logs.error(`Error writing to stdout: ${err.mesage}`);
                    resolve(1);
                });         
            }
        });
    } catch (error) {
        logs.silent = false;
        logs.error(`Error downloading issue "${date}"${sectStr}: ${error.message}`);
        return 1;
    }
}

/**
 * Main function for the application.
 * @async
 * @returns {Promise} - Returns the exit code.
 */
async function main () {
    var command;

    const yargs = require('yargs')
    .version(pkg.version)
    .usage('Usage: economist-audio-downloader [command] [arguments]')
    .strict()
    .option('logLevel', {
        alias: 'l',
        describe: 'Sets the verbosity of log output',
        default: 'info'
    })
    .option('quiet', {
        alias: 'q',
        describe: 'Turns logging off',
        default: false
    })
    .option('username', {
        alias: 'u',
        describe: 'Username to login with'
    })
    .option('password', {
        alias: 'p',
        describe: 'Password to login with'
    })
    .option('config', {
        alias: 'f',
        describe: 'A JSON configuration file to read from'
    })
    .option('proxyUrl', {
        alias: 'x',
        describe: 'The url to a proxy that will be used for all requests. SOCKS(4/5), HTTP(S) and PAC accepted.'
    })
    .command([ '$0', 'download [issue]' ], 'Downloads a zip file containing the audio edition for a given issue', (yargs) => {
        yargs
            .positional('issue', {
                describe: 'Date of the issue to download. Defaults to "latest"',
                demand: true,
                default: 'latest'
            })
            .option('section', {
                alias: 's',
                describe: 'The name or number of the section to download (e.g. "Introduction" or 1). If emtpy will download the entire issue'
            })
            .option('output', {
                alias: 'o',
                describe: 'Output path for the resulting zip file. If not specified will output to stdout. Cannot be used with "--extract"'
            })
            .option('extract', {
                alias: 'e',
                describe: "Extracts the zip file to a given path, creating it if it doesn't exist. Cannot be used with '--output'"
            })
            .option('subdir', {
                alias: 'b',
                describe: 'Will extract to a subdirectory named the date of the issue (e.g. $extract/YYYY-MM-DD)'
            });
    }, (argv) => { 
        command = download.bind(null, argv._);
     })
    .command('list-issues <year>', "Lists all issues for a given year", (yargs) => {
        yargs
            .positional('year', {
                demand: true,
                describe: 'Year to list issues for'
            });
    }, (argv) => { 
        command = list_issues.bind(null, argv._);
    })
    .command('list-issue-sections <issue>', "Lists all issues for a given year", (yargs) => {
        yargs
            .positional('issue', {
                demand: true,
                describe: 'Issue to list sections for'
            });
    }, (argv) => { command = list_issue_sections.bind(null, argv._); })

    nconf = new Provider();

    nconf
        .argv(yargs)
        .env({
            whitelist: env_whitelist.concat(env_whitelist.map(env_to_config)),
            parseValues: true,
            separator: '__',
            transform: (obj) => {
                if (env_whitelist.includes(obj.key)) {
                    if (obj.key.indexOf('_') !== -1) {
                        obj.key = env_to_config(obj.key.toLowerCase().replace('economist_', ''));
                    }
                }
                return obj;
            }
        })
        .defaults(require('./default_config'));

    logs = winston.createLogger({
        level: nconf.get('logLevel'),
        format: winston.format.simple(),
        silent: nconf.get('quiet'),
        transports: [
            new winston.transports.Console({ silent: nconf.get('quiet') })
        ]
    });

    if (nconf.get('config'))
        nconf.file({ file: nconf.get('config') });

    let code = await command(nconf, logs);
    process.exit(code);
}

/**
 * This module contains the command-line logic for the application.
 * @module economist-audio-downloader/launch
 */
module.exports = { 
    main, 
    login, 
    download, 
    list_issues, 
    list_issue_sections
};