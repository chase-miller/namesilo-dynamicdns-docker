# namesilo-dynamicdns-docker
A docker container to update namesilo's dynamic DNS. Forked from https://github.com/fedoranimus/namesilo-dynamicdns-docker.

## Docker
`docker run -d -v /namesilo/ddnsConfig.json:/namesilo/ddnsConfig.json -e API_KEY='ApiKey' chaseamiller/namesilo-ddns`

## Sample `ddnsConfig.json`
For host `example.com` & `www.example.com`

```json
{
    "records": [
        {
            "domainName": "example.com",
            "hostNames": [
                "",
                "www"
            ]
        }
    ],  
    "useCache": true,            // Cache the current IP address. Setting this to true prevents needlessly hitting namesilo's servers.
    "cronConfig": {
        "runCron": true,         // Start a recurring cron job within the runtime. Setting this to true means you can start a docker container and let it run in the background to be sure that namesilo will be updated whenever your IP changes.
        "intervalMinutes": 20    // The number of minutes between cron job runs.
    }
}

```
