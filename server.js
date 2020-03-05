const { promisify } = require('util');
const fs = require('fs');
const readFileAsync = promisify(fs.readFile);
const configFilePath = './ddnsConfig.json';
const { createLogger, format, transports } = require('winston');
const { combine, colorize, timestamp, align, printf, errors, splat } = format;
const apiKey = process.env.API_KEY;

const ddnsUpdater = require('./ddns-updater');

const createLoggerFromLevel = level => {
    return createLogger({
        level: level,
        format: combine(
            splat(),
            colorize(),
            timestamp(),
            align(),
            errors({ stack: true })
        ),
        transports: [new transports.Console({
            format: printf(info => `${info.timestamp} ${info.level}: ${info.message} ${info.stack || ''}`)
        })]
    })
};

const parseConfigFile = async () => {
    var file = await readFileAsync(configFilePath, { encoding: 'utf8' });
    return JSON.parse(file);
}

(async () => {
    var logger = console;

    try {
        const config = await parseConfigFile();
        logger = createLoggerFromLevel(config.logLevel);

        logger.debug('loaded config: %o', config);

        if (apiKey === undefined || apiKey === '') {
            logger.error('Please set the API_KEY env variable.');
            process.exit(1);
        }
        
        await ddnsUpdater.execute(config, logger, apiKey);
    } catch (e) {
        logger.error(e);
        process.exit(1);
    }
})();



