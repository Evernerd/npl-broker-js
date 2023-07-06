const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function contract(ctx) {
    // initialize npl broker object
    const NPL = NPLBroker.init(ctx);
    
    // initialize listener function
    const listener = (packet) => {
        // this is an independent event (NPL round) listener!
        console.log(`node "${packet.node}" sent "${packet.content}" ...`);
    }

    // subscribe (listen) to event (npl round) with listener
    NPL.subscribeRound("TEST ROUND", listener);

    // perform NPL round
    // even if we don't subscribe to an npl round via `.subscribeRound()`, we will still receive an NPL round's results
    const test_NPL_round = await NPL.performNplRound({
        roundName: "TEST ROUND",
        content: `This is a unique NPL message?! Random value: ${Math.floor(Math.random() * 100)}`,
        desiredCount: ctx.unl.count(),
        timeout: 400
    });

    // unsubscribe to npl round
    NPL.unsubscribeRound("TEST ROUND", listener);
    
    console.log(`\nNPL round "${test_NPL_round.roundName}" finished with ${test_NPL_round.record.length} responses in ${test_NPL_round.timeTaken} ms\n`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);