const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function contract(ctx) {
    // initialize NPL broker object
    const NPL = NPLBroker.init(ctx);

    // Perform an NPL round to distribute unique, arbitrary data across the entire network !
    const test_NPL_round = await NPL.performNplRound({
        roundName: `random-number-round`,
        content: Math.floor(Math.random() * 100),
        desiredCount: Math.ceil(ctx.unl.count() * 0.7),
        timeout: 1000
    });

    console.log(`\n - NPL round "${test_NPL_round.roundName}" finished in ${test_NPL_round.timeTaken} ms with ${test_NPL_round.record.length} responses.\n`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);