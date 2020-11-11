# Apartment prices

Apartment prices pulls the apartment sale prices from the Finnish database of apartment sales at https://asuntojen.hintatiedot.fi. The data is public. The site, however, only maintains the prices of the sales of apartments during the last six months. This project pulls the data _and_ maintains the historical data - it's append-only. Eventually the resulting data from the project will contain the historical price data of all registered apartment sales in Finland (that original dataset contains).

## Running

```
npx ts-node index.ts
```
