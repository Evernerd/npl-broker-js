/**
 * 1. This unit test is performed locally in the tester's environment.
 * 2. This unit test aims to ensure npl-broker functions stably as expected with the intended model and code.
 * 3. Each feature of npl-broker must be included in this file in its own respective test case and other overlapping features.
 * 4. Each test case SHOULD include its description, objective, expected result and failure conditions in the code.
 * 
 * TODO:
 * -- Use jest.
 * -- Store and Log all unit_test results in a file.
 * -- Add unit test for Evernode `production` network (mainnet) and testnet.
 *    ^- Ensure unit_test results (in a file) are accessible by the user (this is us)
 */

/**
 * START UNIT TEST
 */
const HotPocket = require('hotpocket-nodejs-contract');
const NPLBroker = require('npl-broker');
const crypto = require('crypto');
const fs = require('fs');

var package = require('../../../package.json');

console.log(`Dependencies: ${package.dependencies}`);

async function delay(ms) {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if the broker's NPL stream works as intended
 */
async function testNplStream(NPL, messageCount) {
    while (messageCount > 0) {
        // Test JSON
        await NPL.send(JSON.stringify({
            content: "dinner with Wo Jake or dinner with Bharath ? 321 @#$",
            randomNumber: 123589,
            randomBoolean: true,
            randomArray: ["Wo Jake", "Bharath"]
        }));        
        // Test string
        await NPL.send("dinner with Wo Jake or dinner with Bharath ? 321 @#$");
        // Test number
        await NPL.send(1234567890);
        // Test boolean
        await NPL.send(true);
        // Test array
        await NPL.send(["Wo", "Jake", "is", "awesome", 3000, true]);
        // Test object
        await NPL.send({"hot":"pocket", "variable": 123, "bool": true});
        messageCount--;
    }    
}

/**
 * Check if we could get the precise number of desired NPL messages
 */
async function testGetDesiredCount(ctx, NPL, roundName, timeout) {
    var point = 0;
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

        if (test_NPL_round.record.length === test_NPL_round.desiredCount) { point++; }
    }
    if (point === ctx.unl.count()) {
        console.log(` --  performNplRound() |              desiredCount threshold: ✅`);
        return true;
    } else {
        console.log(` --  performNplRound() |              desiredCount threshold: ❌ (${point}/${ctx.unl.count()})`);
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
    console.log(` --  performNplRound() |  didn't avoid overlapping NPL round: ❌`)
    return false;
}


/**
 * Check if the checksum is valid, verify the content's integrity on the sender's side 
 */
async function testGetValidChecksum(ctx, NPL, roundName, timeout) {
    const test_NPL_round = await NPL.performNplRound({
        roundName: roundName,
        content: "test content 312 _-= !@# ABC abc",
        desiredCount: ctx.unl.count(),
        checksum: true,
        timeout: timeout
    });

    var point = 0;
    test_NPL_round.record.forEach(message => {
        if (message.checksum === crypto.createHash('sha256').update(message.content).digest('hex')) {
            point++;
        }
    })

    if (point > 0) {
        console.log(` --  performNplRound() |                   checksum is valid: ✅`);
        return true;
    } else {
        console.log(` --  performNplRound() |                 checksum is invalid: ❌`);
        return false;
    }
}

/** 
 * Check if our large content enables chunk transfer
 */
async function testTriggerChunkTransfer(ctx, NPL, roundName, timeout) {
    const string_size_270k_characters = fs.readFileSync(__dirname+"/large.txt", 'utf8');
    
    const test_NPL_round = await NPL.performNplRound({
        roundName: roundName,
        content: string_size_270k_characters,
        desiredCount: ctx.unl.count() / 2,
        timeout: timeout
    });
    
    var point = 0;
    test_NPL_round.record.forEach(NPLResponse => {
        if (NPLResponse.content.length === string_size_270k_characters.length) point++;
    });

    if (point > 0) {
        console.log(` --  performNplRound() |           chunk transfer successful: ✅`);
        return true;
    } else {
        console.log(` --  performNplRound() |         chunk transfer unsuccessful: ❌`);
        return false
    }
}

async function contract(ctx) {
    // NPL-Broker unit test

    // The overall score of this unit test
    var score = 0;

    console.log(`\n npl-broker-js' UNIT TEST (5 tests):`);
    console.log(`    UNL count: ${ctx.unl.count()}\n`);

    // The amount of NPL messages we want in Test #1
    var messageCount = 2;

    // The amount of NPL message we received in Test #1, should be "nplMessageCount == messageCount" for success
    var nplMessageCount = 0;
    const LISTENER_STREAM = (packet) => {
        nplMessageCount++;
    }

    // Initialize npl-broker object
    const NPL = NPLBroker.init(ctx, LISTENER_STREAM);

    // UNIT TEST #1 : using the broker's NPL stream
    const T1 = await testNplStream(NPL, messageCount);

    await delay(1000);
    if (nplMessageCount > 0) {
        console.log(` --  NPL msg stream () |                  NPL stream working: ✅`);
        score++;
    } else {
        console.log(` --  NPL msg stream () |              NPL stream not working: ❌`);
    }

    // UNIT TEST #2 : hitting the correct desiredCount threshold @ performNplRound() 
    const T2 = await testGetDesiredCount(ctx, NPL, "NPLGetDesiredCount", 3000);

    // UNIT TEST #3 : hit an overlapping NPL round to trigger error @ performNplRound()
    const T3 = await testTriggerOverlappingNplRoundError(ctx, NPL, "NPLTriggerOverlappingRound", 1000);

    // UNIT TEST #4 : checksum is valid on sender's side (Content Integrity)
    const T4 = await testGetValidChecksum(ctx, NPL, "NPLGetValidChecksum", 3000)

    // UNIT TEST #5 : enable chunk transfer
    const T5 = await testTriggerChunkTransfer(ctx, NPL, "NPLTriggerChunkTransfer", 5000);

    const tests = [T1, T2, T3, T4, T5];
    tests.forEach(result => {
        if (result) {
            score++;
        }
    })

    console.log(`\n --- UNIT TEST SCORE: ${score} / ${tests.length}\n\n`);
}

const hpc = new HotPocket.Contract();
hpc.init(contract);
/**
 * END UNIT TEST
 */