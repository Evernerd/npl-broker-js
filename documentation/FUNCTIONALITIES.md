This page describes each function, parameter, behavior and value under the `npl-broker` library.

If anything of importance or essence is missing, we urge you to publish an `Issue` under the Github repository or contact the maintainer(s). Thank you.

## Functionalities

Here are all the current features on `npl-broker`, as of `v1.3.1`:

- init()
- .subscribeRound()
- .unsubscribeRound()
- .performNplRound()
- .send()

## `init()`

`init(ctx, stream)`: *Object*

---

Parameters: 

- `Mandatory` ctx: *Object*

The HotPocket contract context.

- `Optional` stream: *Function*

The "*listener*" function for incoming, non-tagged messages in the NPL channel. This function is responsible to receive all non-tagged messages and to respond accordingly based on the message.

**RETURNS:** *Object*

A **Constructor** that initializes an object of the `NPLBroker` class and consumes the instance's NPL channel. After initialization, it returns the `NPLBroker` class.

##### Code Sample:

```js
const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function contract(ctx) {
    // The listener function, this will be called every time a non-tagged message is received in the NPL channel.
    const LISTENER_STREAM = (packet) => {
        console.log(`Non-tagged Message: ${packet}`);
    }

    /* Initialize NPL broker object
    * All the parameters:
    * (MANDATORY) @param {object} ctx - The HotPocket contract's context.
    * (OPTIONAL)  @param {Function} stream - The listener function for non-tagged messages in the NPL channel.
    */
    const NPL = NPLBroker.init(ctx, LISTENER_STREAM);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);
```

## `.subscribeRound()`

`subscribeRound(roundName, listener)`

---

Parameters: 

- `Mandatory` roundName: *string*

The round name that is being subscribed.

- `Mandatory` listener: *function*

The *listener* function that will be called, when an NPL message is received with the round name specified.

Subscribe to a specific round name using a listener function. This function will be triggered whenever an NPL message with the specified round name is received.

##### Code Sample:

```js
const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function contract(ctx) {
    // This function will be called every time a new NPL message is received
    const listener = (packet) => {
        console.log(`node "${packet.node}" sent "${packet.content}" ...`);
    }

    // Subscribe to NPL round "TEST ROUND" using `listener`
    NPL.subscribeRound("TEST ROUND", listener);

    /* 
    * Each time an incoming NPL message with round name "TEST ROUND" is received, it will call the listener function.
    * The listener function could do a bunch of things that you can normally do in a NodeJS runtime, like:
    * - Invoking a database
    * - Compute/Calculate something
    * - Log the message
    * - whatever the limits of Computer Science has to offer.
    */
}

const hpc = new HotPocket.Contract();
hpc.init(contract);
```

## `.performNplRound()`

`await .performNplRound({roundName, content, desiredCount, checksum, timeout})`

---

Parameters:

- `Mandatory` roundName: *Object*

The NPL round name.

- `Optional` content: *Function*

The content that will be distributed across this instance's peers.

- `Mandatory` desiredCount: *Number*

The desired count of NPL messages to collect.

- `Optional` checksum: *Boolean*

Check the content's integrity upon arrival via a checksum hash.

- `Mandatory` timeout: *Number*

The time (in milliseconds) given to this NPL round to conclude.

**RETURNS:** *Object*

Perform an NPL round to distribute and collect NPL messages from peers.

## Code Sample

```js
const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function contract(ctx) {
    const NPL = NPLBroker.init(ctx);
    // perform a NPL round w/ roundName "TEST ROUND"
    const test_NPL_round = await NPL.performNplRound({
        roundName: "TEST ROUND 123",
        content: "Hi, this is 1 unique NPL response!",
        desiredCount: ctx.unl.count(),
        timeout: 1000 // 1 second
    });

    console.log(`\nNPL round "${test_NPL_round.roundName}" finished with ${test_NPL_round.responseCount} responses in ${test_NPL_round.timeTaken} ms\n`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);
```

## `.send()`

`send(packet)`

---

Parameters:

- `Mandatory` packet: *Object*

**RETURNS:** *Object*

Broadcast a non-tagged NPL message across the instance's peers.

## Code Sample

```js
const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function contract(ctx) {
    // The listener function, this will be called every time a non-tagged message is received in the NPL channel.
    const LISTENER_STREAM = (packet) => {
        console.log(`Non-tagged Message: ${packet}`);
    }

    const NPL = NPLBroker.init(ctx, LISTENER_STREAM);

    await NPL.send("string 123") // sending a normal string
    await NPL.send(123) // sending a number
    await NPL.send({
        "key": "value",
        "k3y": 1337
    }) // sending an object
}

const hpc = new HotPocket.Contract();
hpc.init(contract);
```
