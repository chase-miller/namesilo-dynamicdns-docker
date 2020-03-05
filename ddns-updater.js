const publicIp = require('public-ip');
const { promisify, inspect } = require('util');
const fs = require('fs');
const got = require('got');
const xml2js = require ('xml2js');
const parseStringAsync = promisify(xml2js.parseString);
const readFileAsync = promisify(fs.readFile);
const saveFileAsync = promisify(fs.writeFile);
const fileExistsAsync = promisify(fs.exists);
const cacheFilePath = './cache.json';
const cron = require("node-cron");

const ddnsUpdater = (config, logger, apiKey) => {
    const getCurrentIp = async () => {
        return await publicIp.v4();
    }
    
    const getCachedIp = async () => {
        if (!await fileExistsAsync(cacheFilePath)) {
            return '';
        }
    
        var file = await readFileAsync(cacheFilePath, { encoding: 'utf8' });
        var cache = JSON.parse(file);
    
        logger.debug('loaded cache: %e', cache);
    
        return cache.ipAddress;
    }
    
    const updateCachedIp = async ipAddress => {
        var cache = {
            "ipAddress": ipAddress
        };
        await saveFileAsync(cacheFilePath, JSON.stringify(cache), { encoding: 'utf8' });
    
        logger.warn('updated cache: %o', cache);
    }
    
    const listRecordsForDomain = async (domain, hostName) => {
        const uri = `https://www.namesilo.com/api/dnsListRecords?version=1&type=xml&key=${apiKey}&domain=${domain}`;
        tempResponse = await got(uri);
        const response = await parseStringAsync(tempResponse.body);
    
        return convertRecordData(response, domain, hostName);
    }
    
    const convertRecordData = (response, domain, hostName) => {
        let convertedResponse = {};
    
        if(response) {
            const replyCode = response.namesilo.reply[0].code[0];
            let record = null;
            if(hostName !== "")
                record = response.namesilo.reply[0].resource_record.find(x => x.host[0] === `${hostName}.${domain}`);
            else
                record = response.namesilo.reply[0].resource_record.find(x => x.host[0] === `${domain}`);
    
            if(record) {
                convertedResponse = {
                    code: parseInt(replyCode),
                    type: record.type[0],
                    record_id: record.record_id[0],
                    currentIp: record.value[0],
                    ttl: parseInt(record.ttl[0]),
                    hostName: hostName,
                    domain: domain
                };
            }
        }
        
        return convertedResponse;
    }
    
    const updateRecord = async (currentHostIp, domainInfo) => {
        const uri = `https://www.namesilo.com/api/dnsUpdateRecord?version=1&type=xml&key=${apiKey}&domain=${domainInfo.domain}&rrid=${domainInfo.record_id}&rrhost=${domainInfo.hostName}&rrvalue=${currentHostIp}&rrttl=${domainInfo.ttl}`;
        tempResponse = await got(uri);
        return await parseStringAsync(tempResponse.body);
    }
    
    const executeJob = async () => {
        logger.debug('Starting namesilo DDNS refresh check');
    
        const currentHostIp = await getCurrentIp();
        logger.debug(`Host IP: ${currentHostIp}`);
    
        if (config.useCache) {
            const cachedIp = await getCachedIp(config);
    
            if (cachedIp && (currentHostIp === cachedIp)) {
                logger.info(`Current host is the same as the cached ip - ${cachedIp}. Skipping further processing...`);
                return;
            }
        }

        for await (var record of config.records) {
            for await (var hostName of record.hostNames) {
                logger.debug(`Processing ${hostDomainToString(hostName, record.domainName)}`);

                const domainInfo = await listRecordsForDomain(record.domainName, hostName);
    
                if(domainInfo && currentHostIp !== domainInfo.currentIp && domainInfo.code === 300) {
                    logger.warn(`Updating ${hostDomainToString(domainInfo.hostName, domainInfo.domain)} from ${domainInfo.currentIp} to ${currentHostIp}`)
                    const response = await updateRecord(currentHostIp, domainInfo);
                    logger.warn('Updated record', inspect(response, false, null));
                } else {
                    logger.info(`Skipped updating ${hostDomainToString(domainInfo.hostName, domainInfo.domain)} because the IP address is current (${currentHostIp})`)
                }
            }
        }
    
        if (config.useCache) {
            // Only update the cache if we successfully updated all reccors in namesilo.
            await updateCachedIp(currentHostIp);
        }
    
        logger.debug('Finished namesilo DDNS refresh check')
    
        function hostDomainToString(host, domain) {
            if (host === '') {
                return domain;
            }
    
            return `${host}.${domain}`;
        }
    }

    return {
        execute: async () => {
            await executeJob();
    
            if (config.cronConfig.runCron) {
                cron.schedule(`0 */${config.cronConfig.intervalMinutes || 20} * * * *`, async function () {
                    await executeJob();
                });
            }
        }
    }
}

exports.execute = async function(config, logger, apiKey) {
    const updater = ddnsUpdater(config, logger, apiKey);
    await updater.execute();
}