# Economist Audio Downloader

A tool for downloading the audio edition of The Economist. Requires an active subscription to the publication.

[![NPM](https://nodei.co/npm/economist-audio-downloader.png)](https://nodei.co/npm/economist-audio-downloader/)

[![Build Status](https://travis-ci.org/znetstar/economist-audio-downloader.svg?branch=master)](https://travis-ci.org/znetstar/economist-audio-downloader) [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fznetstar%2Feconomist-audio-downloader.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fznetstar%2Feconomist-audio-downloader?ref=badge_shield)

This package contains a command line tool `economist-audio-downloader` as well two classes which can be used to download the publication programmatically.

## Install

Install with `npm install`. If you aren't going to run mocha tests you can run `npm install --only=production` to skip installing mocha.

## Configuration

To see the available commands and arguments run `economist-audio-downloader --help`

The username and password of the economist.com account can be specified via the enviornment variables `ECONOMIST_USERNAME` and `ECONOMIST_PASSWORD`. 

All arguments, including the account credentials can be stored in a json file

Example: 
```
 {
     "username": "...",
     "password": "...",
     "proxy_url": "socks5://..."
 }
```

The configuration file can be referenced with the `--config` or `-f` argument (e.g. `economist-audio-downloader -f config.json`).

## Example

Example:
`economist-audio-downloader download -u ... -p ... --output "~/latest-economist-issue.zip"`

## Programmatic access

This package can be used programmatically. See `src/EconomistAudioDownloader.js` and `src/EconomistClient.js` 

Example: 

```
    const { EconomistAudioDownloader, EconomistClient } = require('economist-audio-downloader');

    let ead = new EconomistAudioDownloader({ username: "...", password: "" });

    ead.download_audio_edition('latest', 'Introduction')
        .then((result) => {
            let out = result.zip.pipe(require('fs').createWriteStream("~/latest-economist-issue.zip"));

            out.on('finish', () => {
                console.log(`Downloaded: ${result.issue_date}`);
            });

            out.on('error', () => {
                ...
            })
        })
        .catch((err) => {
            ...
        });
```

### Documentation

To generate API documentation run `npm run docs`. An online version of the documentation [is available here](https://economist-audio-downloader.docs.zacharyboyd.nyc).

### Tests

Tests are written in mocha. Test with `npm test`.