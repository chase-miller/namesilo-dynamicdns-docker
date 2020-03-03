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
    "cronConfig": {
        "runCron": false,
        "intervalMinutes": 20
    }
}

```
