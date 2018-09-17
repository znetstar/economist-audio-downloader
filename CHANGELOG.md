# Changelog
All notable changes to this project will be documented in this file.

## [1.0.10] - 2018-09-17

### Changed
- Fixes a bug caused by the "unzip" module. Replaces "unzip" with "node-unzip-2".

## [1.0.9] - 2018-09-15

### Changed
- Fixes bug with position arguments
- Config values are now camel case.

### Added
- Adds documentation. To generate docs run `npm run docs`. They will be available under `docs/`.

## [1.0.3] - 2018-09-12
### Changed 
- Changed license to CC0

## [1.0.1] - 2018-09-07
### Changed
- Fixed a bug in reading env variables on startup

## [1.0.0] - 2018-09-07
### Added
- Function to download the audio edition of The Economist as a zip file and extract it
- Function to list issues of a given year
- Function to list sections of a given issue