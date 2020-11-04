const fetch = require('node-fetch');
const cheerio = require('cheerio');

/**
 * Calls the API.
 * 
 * @returns{Promise<Response} the promise
 */
async function callApi() {
    return await fetch("https://asuntojen.hintatiedot.fi/haku/?c=&cr=1&ps=02100&nc=0&amin=&amax=&renderType=renderTypeTable&search=1", {
    "headers": {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "cookie": "JSESSIONID=3BF142747A50736BF3E4785BD34E9D44; _ga=GA1.2.1547373825.1604316836; _gid=GA1.2.1909015753.1604316836; lang=0; textSize=3"
    },
    "referrer": "https://asuntojen.hintatiedot.fi/haku/?c=&cr=1&ps=02100&nc=0&amin=&amax=&renderType=renderTypeTable&search=1",
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "method": "GET",
    "mode": "cors"
        })
    .then(res => res.text())
    .then(text => text);
}

async function parse(response) {
    return cheerio.load(response);
}


async function main() {
    callApi()
    .then(text => parse(text))
    .then($ => {
        //console.log($.html());

        $('#mainTable tbody').each(function(i, elm) {
            console.log($(this).html()) // for testing do text() 
        });       
    }
    );
}



main();


