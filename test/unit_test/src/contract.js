const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function delay(ms) {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if we could get the precise number of desired NPL messages
 */
async function testGetDesiredCount(ctx, NPL, roundName, timeout) {
    var nplRoundscore = 0;
    for (let x = 0; x < ctx.unl.count(); x++) {    
        const start = performance.now();
        const test_NPL_round = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 321",
            desiredCount: ctx.unl.count() - x,
            timeout: timeout / 2
        });
        const timeTaken = performance.now() - start;

        await delay(timeout - timeTaken);

        if (test_NPL_round.desiredCountReached) { nplRoundscore++; }
    }
    if (nplRoundscore === ctx.unl.count()) {
        console.log(` --  performNplRound() |              desiredCount threshold: ✅`);
        return true;
    } else {
        return false;
    }
}

/**
 * Check if we could trigger an Error which indicates that an NPL round overlap is occurring 
 */
async function testTriggerOverlappingNplRoundError(ctx, NPL, roundName, timeout) {
    try {
        const _test_NPL_round = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 321",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });

        const _test_NPL_round1 = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 123",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });

        const _test_NPL_round2 = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 213",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });

        const _test_NPL_round3 = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 312",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });
    } catch (err) {
        // error is unique!
        console.log(` --  performNplRound() |       avoided overlapping NPL round: ✅`)
        return true;
    }
    return false;
}

async function contract(ctx) {
    // NPL-Broker unit test

    // variables
    const roundName = "testNplBroker";
    const timeout = 1000; // ms
    var score = 0;

    console.log(`\n npl-broker-js' UNIT TEST (2 tests):`);
    console.log(`    UNL count: ${ctx.unl.count()}`);

    // initialize npl-broker class
    const NPL = NPLBroker.init(ctx);
    
    // UNIT TEST #1 : hitting the correct desiredCount threshold @ performNplRound() 
    const T1 = await testGetDesiredCount(ctx, NPL, roundName, timeout);

    // UNIT TEST #2 : hit an overlapping NPL round to trigger error @ performNplRound()
    const T2 = await testTriggerOverlappingNplRoundError(ctx, NPL, roundName, timeout);

    const tests = [T1, T2];
    tests.forEach(test => {
        if (test) {
            score++;
        }
    })

    console.log(`\n --- UNIT TEST SCORE: ${score} / ${tests.length}`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);