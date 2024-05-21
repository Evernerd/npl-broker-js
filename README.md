# npl-broker (**NPLBroker**)

![NPM](https://nodei.co/npm/npl-broker.png)

![npm bundle size](https://img.shields.io/bundlephobia/min/npl-broker)

`npl-broker` is a core library that can be easily integrated into your HotPocket (d)app. It serves as an intermediary module to manage the messages sent and received in the NPL stream. This ensures that HotPocket (d)apps and its dependencies, which utilize NPL, can effectively transport data within a standardized format.

`npl-broker` provides additional features for sub-consensus messaging via the NPL stream that HotPocket doesn't provide out-of-the-box, such as:
1. Tagged NPL messages
2. Live NPL stream (The default approach to sub-consensus messaging is opt-able)
3. Chunk transfer for large content transfers
4. Content integrity verification

# Installation

```
npm install npl-broker
```

# Testing

The `/test` directory includes general HP dApps that showcases `NPLBroker`. Running this will result in a unit test:

```
sudo npm test
```