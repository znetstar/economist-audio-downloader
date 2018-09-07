const nconf = require('nconf');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), 'utf8'));
const { EconomistAudioDownloader } = require('./');
const unzip = require('unzip');
const fstream = require('fstream');
const moment = require('moment');

var logs, factory;

const env_whitelist = [
    "log_level",
    "economist_username",
    "economist_password",
    "proxy_url",
    "http_proxy"
].map((e) => e.toUpperCase());

function EADFactory(nconf) {
    return new EconomistAudioDownloader({ username: nconf.get('username'), password: nconf.get('password') }, nconf.get('proxy_url'), nconf.get('user_agent'));
}

async function login(nconf, logs, downloader, stdout) {
    if (!stdout)
        logs.debug(`Logging in to user ${downloader.credentials.username}`);
    try {
        await downloader.login();
        return 0;
    }
    catch (error) {
        logs.error(`An error occured logging in: ${error.message}`);
        return 1;
    }

}


async function list_issues(nconf, logs) {
    let downloader = EADFactory(nconf);

    let login_code = await login(nconf, logs, downloader);
    if (login_code > 0) return login_code;
    
    try {
        let issues = await downloader.list_issues(nconf.get('year'));
        process.stdout.write(issues.map((d) => moment(d).format("YYYY-MM-DD")).join("\n"));
        return 0;
    } catch (error) {
        logs.error(`Error getting issues for ${nconf.get('year')}: ${error.message}`);
        return 1;
    }
}

async function list_issue_sections(nconf, logs) {
    let downloader = EADFactory(nconf);

    let login_code = await login(nconf, logs, downloader, !(nconf.get('output') || nconf.get('extract')));
    if (login_code > 0) return login_code;
    
    try {
        let sections = await downloader.list_issue_sections(nconf.get('issue'));
        process.stdout.write(sections.join("\n"));
        return 0;
    } catch (error) {
        logs.error(`Error getting issues for ${nconf.get('issue')}: ${error.message}`);
        return 1;
    }
}

async function download(nconf, logs) {
    let downloader = EADFactory(nconf);

    let date = nconf.get('issue');
    let section = nconf.get('section');
    let sectStr = section ? " section " + section : "";

    let output = nconf.get('output');
    let extract = nconf.get('extract');

    if (output && extract) {
        logs.error("Cannot download and extract");
        return 1;
    }

    let login_code = await login(nconf, logs, downloader);
    if (login_code > 0) return login_code;

    if (extract || output)
        logs.info(`Downloading audio for issue ${date}${ sectStr }`);
    try {
        let { zip } = await downloader.download_audio_edition(date, section);
        
        return new Promise((resolve) => {
            if (output) {
                let out = zip.pipe(fs.createWriteStream(output));

                out.on('finish', () => {
                    logs.info(`Successfully wrote ${date}${sectStr} to "${output}"`);
                    resolve(0);
                })

                out.on('error', (err) => {
                    logs.error(`Error writing to "${output}": ${err.mesage}`);
                    resolve(1);
                });  
            } else if (extract) {
                let out = zip
                    .pipe(unzip.Parse())
                    .pipe(fstream.Writer(extract));

                out.on('close', () => {
                    logs.info(`Successfully extracted ${date}${sectStr} to "${extract}"`);
                    resolve(0);
                })

                out.on('error', (err) => {
                    logs.error(`Error extracting to "${extract}": ${err.mesage}`);
                    resolve(1);
                });  
            } else { // Stdout
                let out = zip.pipe(process.stdout)
                out.on('finish', () => {
                    resolve(0);
                })

                out.on('error', (err) => {
                    logs.error(`Error writing to stdout: ${err.mesage}`);
                    resolve(1);
                });         
            }
        });
    } catch (error) {
        logs.error(`Error downloading issue ${date}${sectStr}: ${error.message}`);
        return 1;
    }
}

function main () {
    var command;

    const yargs = require('yargs')
    .version(pkg.version)
    .usage('Usage: economist-image-downloader [command] [arguments]')
    .strict()
    .option('log_level', {
        alias: 'l',
        describe: 'Sets the verbosity of log output',
        default: 'info'
    })
    .option('quiet', {
        alias: 'q',
        describe: 'Turns logging off',
        default: false
    })
    .command([ '$0', 'download [issue]' ], 'Downloads a zip file containing the audio edition for a given issue', (yargs) => {
        yargs
            .positional('issue', {
                alias: 'i',
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
            });
    }, (argv) => { command = download; })
    .command('list-issues <year>', "Lists all issues for a given year", (yargs) => {
        yargs
            .positional('year', {
                alias: 'y',
                demand: true,
                describe: 'Year to list issues for'
            });
    }, (argv) => { command = list_issues; })
    .command('list-issue-sections <issue>', "Lists all issues for a given year", (yargs) => {
        yargs
            .positional('issue', {
                alias: 'i',
                demand: true,
                describe: 'Issue to list sections for'
            });
    }, (argv) => { command = list_issue_sections; })

    nconf
        .argv(yargs)
        .env({
            whitelist: env_whitelist,
            parseValues: true,
            separator: '__',
            transform: (obj) => {
                if (env_whitelist.includes(obj.key)) {
                    obj.key = obj.key.toLowerCase().replace('economist_', '');
                }
                return obj;
            }
        })
        .defaults(require('./default_config'));


    logs = winston.createLogger({
        level: nconf.get('log_level'),
        format: winston.format.simple(),
        silent: nconf.get('quiet'),
        transports: [
            new winston.transports.Console({ silent: nconf.get('quiet') })
        ]
    });

    command(nconf, logs).then((code) => process.exit(code));
}

module.exports = { main, login, download, list_issues, list_issue_sections };