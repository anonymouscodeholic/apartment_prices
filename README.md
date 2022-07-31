# Apartment prices

Apartment prices pulls the apartment sale prices from the Finnish database of apartment sales at https://asuntojen.hintatiedot.fi. The data is public. The site, however, only maintains the prices of the sales of apartments during the last six months. This project pulls the data _and_ maintains the historical data - it's append-only. Eventually the resulting data from the project will contain the historical price data of all registered apartment sales in Finland (that original dataset contains).

Note this repo does not store the fecthed results anywhere due to licensing issues. The site from which the data is fecthed doesn't say anything about licensing of the fetched data, but to not take any decisions on whether or not it's permitted to share the results, the decision here is not to store.

## Running

```
npm install
npx ts-node index.ts
```
