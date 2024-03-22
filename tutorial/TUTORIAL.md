`npl-broker-js` is a library that could easily be plug into your HotPocket contract code.

The library follows a OOP approach, in which, devs must initialize the object before being able to utilize it.

`npl-broker-js` is event-basedan [EventEmitter](https://nodejs.dev/en/learn/the-nodejs-event-emitter/) wrapper tailor made to manage HotPocket's NPL channel.

Here are all the available features on `npl-broker-js`:

- init()
- .subscribeRound()
- .unsubscribeRound()
- .performNplRound()

## init() - Initializing the NPL Broker object

`init()` initializes the NPL Broker's class.

```js
const NPL = NPLBroker.init(ctx);
```

## .subscribeRound() - Subscribing to a NPL round name

`.subscribeRound()` subscribes to a NPL round name, listening for incoming NPL messages.

```js
// this function will be called every time a new NPL message is received
const listener = (packet) => {
    console.log(`node "${packet.node}" sent "${packet.content}" ...`);
}

// subscribe to NPL round "TEST ROUND" w/ `listener`
NPL.subscribeRound("TEST ROUND", listener);
```

## .performNplRound() - Performing an NPL round

`.performNplRound()` will initiate an NPL round to distribute & collect data from the instance's peers.

## Code Sample

```js
const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function contract(ctx) {
    const NPL = NPLBroker.init(ctx);

    // this function will be called every time a new NPL message is received
    const listener = (packet) => {
        console.log(`node "${packet.node}" sent "${packet.content}" ...`);
    }

    // subscribe to NPL round "TEST ROUND" w/ `listener`
    NPL.subscribeRound("TEST ROUND", listener);

    // perform a NPL round w/ roundName "TEST ROUND"
    const test_NPL_round = await NPL.performNplRound({
        roundName: "TEST ROUND",
        content: "Hi, this is 1 unique NPL response!",
        desiredCount: ctx.unl.count(),
        timeout: 400
    });

    // unsubscribe our previous `listener` from NPL round "TEST ROUND"
    NPL.unsubscribeRound("TEST ROUND", listener);
    
    console.log(`\nNPL round "${test_NPL_round.roundName}" finished with ${test_NPL_round.responseCount} responses in ${test_NPL_round.timeTaken} ms\n`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);
```