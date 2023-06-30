const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function contract(ctx) {
    const NPL = NPLBroker.init({
        mode: "public",
        maxListeners: 2,
        ctx: ctx
    });

    const listener = (packet) => {
        // this is an independent event (NPL round) listener!
        console.log(`node "${packet.node}" sent "${packet.content}" ...`);
    }

    NPL.subscribeRound("TEST ROUND", listener);

    const test_NPL_round = await NPL.performNplRound({
        roundName: "TEST ROUND",
        content: "Hi, this is 1 unique NPL response!",
        desiredCount: ctx.unl.count(),
        timeout: 400
    });

    NPL.unsubscribeRound("TEST ROUND", listener);
    
    console.log(`\nNPL round "${test_NPL_round.roundName}" finished with ${test_NPL_round.data.length} responses in ${test_NPL_round.timeTaken} ms\n`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);