import { replaceWith } from "cheerio/lib/api/manipulation";

global.fetch = require("node-fetch");
const cheerio = require('cheerio');

/**
 * Calls the API.
 * 
 * Parameters, 1st call:
 * c=
 * cr=1
 * ps=02100
 * nc=0
 * amin=
 * amax=
 * renderType=renderTypeTable
 * search=1
 * 
 * Parameters, 2nd call
 * cr=1
 * ps=02100
 * t=3
 * l=0
 * z=2
 * search=1
 * sf=0
 * so=a
 * renderType=renderTypeTable
 * print=0
 * submit=seuraava+sivu+%C2%BB
 * 
 * Diff
 * Common
 * cr=1
 * ps=02100
 * renderType=renderTypeTable
 * search=1
 * 
 * 1st has unique
 * c
 * nc
 * amin
 * amax
 * 
 * 2nd has unique
 * t=3
 * l=0
 * z=2
 * sf=0
 * so=a
 * print=0
 * 
 * It seems z controls the page:
 * 
 * This gets the 2nd page
 * https://asuntojen.hintatiedot.fi/haku/?cr=1&ps=02100&t=3&l=0&z=2&search=1&sf=0&so=a&renderType=renderTypeTable&print=0
 * 
 * and this gets the 1st page
 * https://asuntojen.hintatiedot.fi/haku/?cr=1&ps=02100&t=3&l=0&z=1&search=1&sf=0&so=a&renderType=renderTypeTable&print=0
 * 
 * @returns{Promise<Response>} the promise
 */

async function callApi(postalCode: string, page: number) {
    const url:string = "https://asuntojen.hintatiedot.fi/haku/?cr=1&ps=" + postalCode + "&t=3&l=0&z=" + page + "&search=1&sf=0&so=a&renderType=renderTypeTable&print=0";
    console.log("postalCode " + postalCode + ", page: " + page + ", URL " + url);
    return await fetch(url, {
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
    .then(res => res.text());
}

/**
 * Parses the given HTML using Cheerio.
 * 
 * @param html the HTML string
 */
async function parse(html: string) {
    return cheerio.load(html);
}

/**
 * Represents a single apartment from the site asuntojen.hintatiedot.fi. Note apartmentType 
 * is not directly available from the individual table row, but from the header.
 */
interface Apartment {
    apartmentType: string;
    neighborhood: string;
    rooms: string;
    houseType: string;    
    squareMeters: number;
    price: number;
    pricePerSquareMeter: number;
    constructionYear: number;
    floor: string;
    elevator: boolean;
    condition: string;
    property: string;
    energyClass: string;
}

/**
 * Parses the value as float, understands comma as decimal separator.
 * 
 * @param value the value
 */
function asFloat(value: string) {
    return parseFloat(value.replace(/,/g, '.'));
}

function tdText(tds, index: number) {
    return tds.eq(index).text().replace(/\t/gm, '');
}

async function pullSinglePageApartments(postalCode: string, page: number) {
    return callApi(postalCode, page)
    .then(text => parse(text))
    .then($ => {
        const listsOfApartmentLists = $('#mainTable tbody')
        .filter(function(i, el) {
            return (($(this).attr('class') === 'odd' || $(this).attr('class') === 'even')) && $(this).find('td[class=section]').length > 0;
        })
        .map(function(i, elem) {
            return $(this).find('tr').map(function(i2, elem2) {
                if ($(this).children().length === 1) {
                    return {apartmentType: $(this).children().first().find('strong').eq(0).text()};
                } else {
                    const tds = $(this).children();
                    const a:Apartment = {
                        apartmentType: null,
                        neighborhood: tdText(tds, 0),
                        rooms: tdText(tds, 1),
                        houseType: tdText(tds, 2),
                        squareMeters: asFloat(tdText(tds, 3)),
                        price: asFloat(tdText(tds, 4)),
                        pricePerSquareMeter: asFloat(tdText(tds, 5)),
                        constructionYear: asFloat(tdText(tds, 6)),
                        floor: tdText(tds, 7),
                        elevator: tdText(tds, 8) === 'on',
                        condition: tdText(tds, 9),
                        property: tdText(tds, 10),
                        energyClass: tdText(tds, 11)
                    }

                    return a;
                }
            });
        }).get();

        // Set apartmentType in each apartment and collect all apartments to a single list

        var apartments = [];
        var apartmentType: string = null;
        var i;
        for (i = 0; i < listsOfApartmentLists.length; i++) {
            const listsOfApartments = listsOfApartmentLists[i];

            var j;
            for (j = 0; j < listsOfApartments.length; j++) {
                if (j === 0) {
                    apartmentType = listsOfApartments[0].apartmentType;
                } else {
                    listsOfApartments[j].apartmentType = apartmentType;
                    apartments.push(listsOfApartments[j]);
                }
            }
        }

        return apartments;
    });
}

async function pullApartments(postalCode: string) {
    const allPagesApartment = [];
    
    var page = 1;
    var thisPageApartments = []
    do {
        thisPageApartments = await pullSinglePageApartments(postalCode, page);

        if (thisPageApartments.length > 0) {
            allPagesApartment.push(...thisPageApartments);
        }

        page++;
    } while (thisPageApartments.length > 0);

    return allPagesApartment;
}

async function main() {
    pullApartments("02110").then(aps => console.log(aps));

}


main();