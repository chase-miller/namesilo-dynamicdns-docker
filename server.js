require('log-timestamp');
const publicIp = require('public-ip');
const jsonFile = require('jsonfile');
const { promisify, inspect } = require('util');
const fs = require('fs');
const got = require('got');
const parseStringAsync = promisify(require('xml2js').parseString);
const readFileAsync = promisify(fs.readFile);
const saveFileAsync = promisify(fs.writeFile);
const fileExistsAsync = promisify(fs.exists);
const configFilePath = './ddnsConfig.json';
const cacheFilePath = './cache.json';
const apiKey = process.env.API_KEY;
const cron = require("node-cron");

const getCurrentIp = async () => {
    return await publicIp.v4();
}

const getCachedIp = async () => {
    if (!await fileExistsAsync(cacheFilePath)) {
        return '';
    }

    var file = await readFileAsync(cacheFilePath, { encoding: 'utf8' });
    var cache = JSON.parse(file);

    console.log('cache:', cache);

    return cache.ipAddress;
}

const updateCachedIp = async ipAddress => {
    var cache = {
        "ipAddress": ipAddress
    };
    await saveFileAsync(cacheFilePath, JSON.stringify(cache), { encoding: 'utf8' });
}

const parseConfigFile = async () => {
    var file = await readFileAsync(configFilePath, { encoding: 'utf8' });
    return JSON.parse(file);
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

const executeJob = async config => {
    const currentHostIp = await getCurrentIp();
    console.log(`Host IP: ${currentHostIp}`);

    if (config.useCache) {
        const cachedIp = await getCachedIp();

        if (cachedIp && (currentHostIp === cachedIp)) {
            console.log(`Current host is the same as the cached ip - ${cachedIp}. Exiting...`);
            return;
        }
    }

    config.records.forEach(async (record) => {
        record.hostNames.forEach( async (hostName) => {
            console.log(`Processing ${hostDomainToString(hostName, record.domainName)}`);
            const domainInfo = await listRecordsForDomain(record.domainName, hostName);

            if(domainInfo && currentHostIp !== domainInfo.currentIp && domainInfo.code === 300) {
                console.log(`Updating ${hostDomainToString(domainInfo.hostName, domainInfo.domain)} from ${domainInfo.currentIp} to ${currentHostIp}`)
                const response = await updateRecord(currentHostIp, domainInfo);
                console.log('Updated record', inspect(response, false, null));
            } else {
                console.log(`Skipped updating ${hostDomainToString(domainInfo.hostName, domainInfo.domain)} because the IP address is current (${currentHostIp})`)
            }
        });
    });

    if (config.useCache) {
        // Only update the cache if we successfully updated all reccors in namesilo.
        await updateCachedIp(currentHostIp);
    }

    function hostDomainToString(host, domain) {
        if (host === '') {
            return domain;
        }

        return `${host}.${domain}`;
    }
}

const main = async () => {
    if (apiKey === undefined || apiKey === '') {
        throw Error('Please set the API_KEY env variable.')
    }

    const config = await parseConfigFile();
    console.log(config);
    
    // Run on start and then on interval.
    await executeJob(config);

    if (config.cronConfig.runCron) {
        cron.schedule(`0 */${config.cronConfig.intervalMinutes || 20} * * * *`, async function () {
            await executeJob(config);
        });
    }
}

(async () => {
    try {
        await main();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();



