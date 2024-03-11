# npl-broker-js

An NPL Brokerage library for HP instances to effectively manage their NPL messages.

`npl-broker-js` provides additional features and protocols for NPL messaging. Facilitating broader utilization throughout the development lifecycle and production phase.

Features:
1. Tagged NPL messages
2. Live NPL message stream (baseline use of NPL intact)
3. Chunk transfer for large content transfers
4. Content integrity verification

`npl-broker-js` provides a standardized implementation of `EVS-01`.

`npl-broker-js` is available on [npm](https://www.npmjs.com/package/npl-broker):

```
npm install npl-broker
```

# Testing

`/test` includes general HP dApps that showcases `npl-broker-js`.

```md
sudo npm test
```