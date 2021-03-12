import { data } from "cheerio/lib/api/attributes";
import { replaceWith } from "cheerio/lib/api/manipulation";

const fs = require('fs');

global.fetch = require("node-fetch");
const cheerio = require('cheerio');

const postalCodesFile = "postalcodes.json";

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
 * Represents a single apartment from the site asuntojen.hintatiedot.fi plus additional meta info.
 * 
 * - apartmentType: not directly available from the individual table row, but from the header.
 * - fingerprint: attempt to have a unique key per apartment to distinguish one from another.
 * - firstSeenDate: YYYYMMDD, when first seen in the API
 * - lastSeenDate: YYYYMMDD, when first seen in the API
 */
interface Apartment {
    id: string,
    fingerprint: string,
    firstSeenDate: string,
    lastSeenDate: string,

    // Section header
    apartmentType: string;

    // The rest in from each row
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
            return (($(this).attr('class') === 'odd' || $(this).attr('class') === 'even')) &&
            $(this).find('td[class=section]').length > 0 &&
            !$(this).text().includes("joten tuloksia ei"); // Omitting if no results for this apartment size
        })
        .map(function(i, elem) {            
            return $(this).find('tr').map(function(i2, elem2) {
                if ($(this).children().length === 1) {
                    return {
                        apartmentTypeHeader: $(this).children().first().find('strong').eq(0).text()
                    };
                } else {
                    const tds = $(this).children();
                    const a:Apartment = {
                        id: null,
                        fingerprint: null,
                        apartmentType: null,
                        firstSeenDate: null,
                        lastSeenDate: null,
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
        var apartmentTypeHeader: string = null;
        var i;
        for (i = 0; i < listsOfApartmentLists.length; i++) {
            const listsOfApartments = listsOfApartmentLists[i];

            var j;
            for (j = 0; j < listsOfApartments.length; j++) {
                if (j === 0) {
                    apartmentTypeHeader = listsOfApartments[0].apartmentTypeHeader;
                } else {
                    listsOfApartments[j].apartmentType = apartmentTypeHeader;
                    apartments.push(listsOfApartments[j]);
                }
            }
        }

        return apartments;
    });
}

async function pullApartments(postalCode: string): Promise<Array<Apartment>> {
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

/**
 * Calculates a fingerprint for an Apartment
 * 
 * @param apartment the apartment
 */
function fingerprint(apartment: Apartment) {
    return `${apartment.apartmentType}_${apartment.neighborhood}_${apartment.rooms}_${apartment.houseType}_${apartment.squareMeters}_${apartment.price}_${apartment.constructionYear}_${apartment.floor}`
}

async function pullAndFingerprint(postalCode: string): Promise<Array<Apartment>> {
    return pullApartments(postalCode)
        .then(aps => {
            aps.map(ap => {
                ap.fingerprint = fingerprint(ap);
            });
            return aps;
        });
}

function databaseFileName(postalCode: string, date?: string) {
    if (date === undefined) {
        return `db/${postalCode}.json.gz`;
    } else {
        return `db/${postalCode}/${postalCode}-${date}.json.gz`;
    }
}

function databaseDir(postalCode: string, date?: string) {
    if (date === undefined) {
        return `db`;
    } else {
        return `db/${postalCode}`;
    }
}

function databaseRead(postalCode: string, date?: string): Array<Apartment> {
    return JSON.parse(fs.readFileSync(databaseFileName(postalCode, date)));
}

function databaseWrite(apartments: Array<Apartment>, postalCode: string, date?: string) {
    const dir = databaseDir(postalCode, date);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    fs.writeFileSync(databaseFileName(postalCode, date), JSON.stringify(apartments, null, 2) , 'utf-8');
}

function databaseExists(postalCode: string, date?: string) : boolean {
    return fs.existsSync(databaseFileName(postalCode, date));
}

function getPostalCodes(): Array<string> {
    const postalCodes: Array<string> = JSON.parse(fs.readFileSync(postalCodesFile))
        .filter((postalCodeData) => {
            return postalCodeData.typeCode === "1"
        })
        .map((postalCodeData) => {
            return postalCodeData.postalCode;
        })
    postalCodes.sort()

    return postalCodes
}

/**
 * Tries to read the db of yesterday of todayDate, then yesterday of that etc
 * until finds file. If doesn't find, returns [null, null].
 * 
 * @param postalCode the postal code
 * @param todayDate the date from which yesterday to start the scan
 */
function readPreviousDatabase(postalCode: string, todayDate: string): [Array<Apartment>, string] {
    const firstDate = "20201101";

    var date: string = toYesterday(parseDate(todayDate));

    while (date !== firstDate) {
        if (databaseExists(postalCode, date)) {
            return [databaseRead(postalCode, date), date];
        }
        date = toYesterday(parseDate(date));
    }

    return [null, null];

    function toYesterday(date: Date): string {
        date.setDate(date.getDate() - 1);
        return formatDate(date);
    }
}

/**
 * https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
 */
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

function assignId(apartment: Apartment): Apartment {
    apartment.id = uuidv4();
    return apartment;
}

/**
 * Returns the date as YYYYMMDD.
 * 
 * @param date the date
 */
function formatDate(date): string {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('');
}

/**
 * Parse a Date from str.
 * 
 * @param date the date as YYYYMMDD
 */
function parseDate(str): Date {
    var y = str.substr(0,4),
        m = str.substr(4,2) - 1,
        d = str.substr(6,2);
    var D = new Date(y,m,d);
    if (D.getFullYear() == y && D.getMonth() == m && D.getDate() == d) {
        return D;
    } else {
        console.log(`Invalid ${str}`);
        return null;
    }
}

function filterPostalcodes(postalCodes:Array<string>, date:string) {
    return postalCodes.filter(postalCode => {
        if (databaseExists(postalCode, date)) {
            console.log(`postalCode ${postalCode} already done for ${date}`);
            return false;
        } else {
            return true;
        }
    });
}

async function main() {
    const dateToday = formatDate(new Date());

    const postalCodes:Array<string> = filterPostalcodes(getPostalCodes(), dateToday);        
    
    for (const postalCode of postalCodes) {
        const apartments:Array<Apartment> = await pullAndFingerprint(postalCode);
        if (!databaseExists(postalCode)) {
            console.log(`No root DB for ${postalCode}, creating`);
            databaseWrite([], postalCode);
        }
        const rootApartments: Array<Apartment> = databaseRead(postalCode);                    
        const [previousApartments, previousDate] = readPreviousDatabase(postalCode, dateToday);
        if (previousApartments === null) {
            console.log(`No previousApartments for ${postalCode} dateToday ${dateToday}`)
        }

        apartments.forEach(apartment => {
            const previousApartment = previousApartments != null ? previousApartments.find(previousApartment => apartment.fingerprint === previousApartment.fingerprint) : null;
            const rootApartment = rootApartments.find(rootApartment => apartment.fingerprint === rootApartment.fingerprint);
            if (previousApartment !== undefined && previousApartment !== null) {                            
                if (rootApartment === undefined) {
                    console.log(`ERROR: BUG: apartment of ${postalCode} in previous (${previousDate}) but not in root ${apartment.fingerprint}. Not "fixing", i.e. adding to root`);
                } else {
                    rootApartment.lastSeenDate = dateToday;
                }
            } else {
                if (rootApartment !== undefined) {
                    console.log(`WARN: apartment of ${postalCode} not in previous (${previousDate}), but exists in root. Very unlikely that there's exactly the same apartment again. Not creating a duplicate ${apartment.fingerprint}`);
                } else {
                    const newRootApartment = Object.assign({}, apartment);
                    newRootApartment.firstSeenDate = dateToday;
                    newRootApartment.lastSeenDate = dateToday;
                    assignId(newRootApartment);
                    rootApartments.push(newRootApartment);

                    console.log(`NEW: id: ${newRootApartment.id} fingerprint: ${newRootApartment.fingerprint}`);
                }
            }
        });
        
        databaseWrite(rootApartments, postalCode);
        databaseWrite(apartments, postalCode, dateToday);
    }
}

main();
