const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');

async function delay(ms) {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

async function testGetDesiredCount(ctx, NPL, listener, roundName, timeout, maxListeners) {
    var nplRoundscore = 0;
    for (let x = 0; x < ctx.unl.count(); x++) {
        if (x+1 < maxListeners) {
            NPL.subscribeRound(roundName, listener);        
        }
        
        const start = performance.now();
        const test_NPL_round = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 321",
            desiredCount: ctx.unl.count() - x,
            timeout: timeout
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

async function testHitSubscriberLimitPNR(ctx, NPL, listener, roundName, timeout, maxListeners) {
    try {
        NPL.subscribeRound(roundName, listener);        

        const _test_NPL_round = await NPL.performNplRound({
            roundName: roundName,
            content: "test content 321",
            desiredCount: ctx.unl.count(),
            timeout: timeout
        });
    } catch (err) {
        if (err.toString() === `Error: roundName "${roundName}" already exist or the amount of subscribers is exceeding the set limit of ${maxListeners}!`) {
            console.log(` --  performNplRound() |                    subscriber limit: ✅`);
            return true;
        }
    }
    return false;
}

async function testHitSubscriberLimitSR(NPL, listener, roundName, maxListeners) {
    try {
        NPL.subscribeRound(roundName, listener);
    } catch (err) {
        if (err.toString() === `Error: roundName "${roundName}" already exist or the amount of subscribers is exceeding the set limit of ${maxListeners}!`) {
            console.log(` --   subscribeRound() |                    subscriber limit: ✅`);
            return true;
        }
    }
    return false;
}

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
    } catch (err) {
        // error is unique -> [ CRITICAL - ${packet.node} sent more than 1 response in NPL round "${roundName}" ] 
        console.log(` --  performNplRound() |       avoided overlapping NPL round: ✅`)
        return true;
    }
    return false;
}

async function contract(ctx) {
    // NPL-Broker unit test

    // variables
    const mode = "public";
    const roundName = "testNplBroker";
    const maxListeners = 2;
    const timeout = 300;
    var score = 0;

    console.log(`\n npl-broker-js' UNIT TEST (4 tests):`);
    console.log(`         MODE: ${mode}`);
    console.log(`    UNL count: ${ctx.unl.count()}`);
    console.log(` Max Listener: ${maxListeners}\n`);

    // initialize npl-broker class
    const NPL = NPLBroker.init({
        mode: mode,
        maxListeners: maxListeners,
        ctx: ctx
    });

    const listener = (packet) => {
        // this is an independent event (NPL round) listener!
        // console.log(`NODE: ${packet.node}`);
        // console.log(`CONTENT: ${packet.content}\n`);
        13+37;
    }
    
    // UNIT TEST #1 : hitting the correct desiredCount threshold @ performNplRound() 
    const T1 = await testGetDesiredCount(ctx, NPL, listener, roundName, timeout, maxListeners);

    // UNIT TEST #2 : hitting the subscriber (listener) limit @ performNplRound(). PNR
    const T2 = await testHitSubscriberLimitPNR(ctx, NPL, listener, roundName, timeout, maxListeners);

    // UNIT TEST #3 : hitting the subscriber (listener) limit @ subscribeRound(). SR
    const T3 = await testHitSubscriberLimitSR(NPL, listener, roundName, maxListeners);

    // UNIT TEST #4 : hit an overlapping NPL round to trigger error @ performNplRound()
    const T4 = await testTriggerOverlappingNplRoundError(ctx, NPL, roundName, timeout);

    const tests = [T1, T2, T3, T4];
    tests.forEach(test => {
        if (test) {
            score++;
        }
    })

    console.log(`\n --- UNIT TEST SCORE: ${score} / ${tests.length}`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);