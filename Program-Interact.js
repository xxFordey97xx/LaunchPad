// #Initialise Deployment Script

const algosdk = require('algosdk');

// User declared algod connection parameters

algodAddress = "http://localhost:4001";
algodServer = "http://localhost";
algodPort = 4001;
algodToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

// Declare application state storage (immutable)

localInts = 1;
localBytes = 1;
globalInts = 1;
globalBytes = 1;

// #Setting up Deployment Functions

// Compiler Function

async function complieProgram(client, programSource) {
    let encoder = new TextEncoder();
    let programBytes = encoder.encode(programSource);
    let compileResponse = await client.compile(programBytes).do();
    let compiledBytes = new Uint8Array(Buffer.from(compileResponse.result, "base64"));
    return compiledBytes;
}

// Confirmation Function

const waitForConfirmation = async function (algodclient, txID) {
    let status = (await algodclient.status().do());
    let lastRound = status["last-round"];
        while (true) {
            const pendingInfo = await algodclient.pendingTransactionInformation(txID).do();
            if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
                //Got the completed Transaction
                console.log("Transaction " + txID + " confirmed in round " + pendingInfo["confirmed-round"]);
                break;
            }
            lastRound++;
            await algodclient.statusAfterBlock(lastRound).do();
        }
};

// Create new application

async function createApp(client, creatorAccount, approvalProgram, clearProgram, localInts, localBytes, globalInts, globalBytes) {
    
    // Define sender as creator
    sender = createAccount.addr;
    
    // Declare onComplete as NoOp
    onComplete = algosdk.OnApplicationComplete.OptInOC;

    // Get node suggested parameters
    let params = await client.getTransactionParams().do();

    // Create unsigned transaction
    let txn = algosdk.makeApplicationCreateTxn(sender, params, onComplete, approvalProgram, clearProgram, localInts, localBytes, globalInts, globalBytes,);
    let txID = txn.txID().toString();

    // Sign the transaction
    let signedTxn = txn.signTxn(creatorAccount.sk);
    console.log("Signed transaction with txID: %s", txID);

    // Submit the transaction
    await client.sendRawTransaction(signedTxn).do();
    
    // Wait for confirmation
    await waitForConfirmation(client, txID);
    
    // Display results
    let transactionResponse = await client.pendingTransactionInformation(txID).do();
    let appId = transactionResponse['application-index'];
    console.log("Created new app-id: ", appId);
    return appId;
}

// #Opting In Function

// OptIn
async function optInApp(client, account, index) {
    
    // Define sender
    sender = account.addr;

    // Get node suggested parameters
    let params = await client.getTransactionParams().do();

    // Create unsigned transaction
    let txn = algosdk.makeApplicationOptInTxn(sender, params, index);
    let txID = txn.txID().toString();

    // Sign the transaction
    let signedTxn = txn.signTxn(account.sk);
    console.log("Signed transaction with txID: %s", txID);

    // Submit the transaction
    await client.sendRawTransaction(signedTxn).do();

    // Wait for confirmation
    await waitForConfirmation(client, txID);

    // Display results
    let transactionResponse = await client.pendingTransactionInformation(txID).do();
    console.log("Opted-in to app-id:", transactionResponse['txn']['txn']['apid'])
}

// #Calling App Function

// Call application
async function callApp(client, account, index, appArgs) {

    // Define sender
    sender = account.addr;

    // Get node suggested parameters
    let params = await client.getTransactionParams().do();

    // Create unsigned transaction
    let txn = algosdk.makeApplicationNoOpTxn(sender, params, index, appArgs)
    let txID = txn.txID().toString();

    // Sign the transaction
    let signedTxn = txn.signTxn(account.sk);
    console.log("Signed transaction with txID: %s", txID);

    // Submit the transaction
    await client.sendRawTransaction(signedTxn).do();

    // Wait for confirmation
    await waitForConfirmation(client, txID);

    // Display results
    let transactionResponse = await client.pendingTransactionInformation(txID).do();
    console.log("Called app-id:", transactionResponse['txn']['txn']['apid'])
    if (transactionResponse['global-state-delta'] !== undefined) {
        console.log("Global State updated:", transactionResponse['global-state-delta']);
    }
    if (transactionResponse['local-state-delta'] !== undefined) {
        console.log("Local State updated:", transactionResponse['local-state-delta']);
    }
}

// #Read Local & Global States

// Read local state of application from user account
async function readLocalState(client, account, index) {
    let accountInfoResponse = await client.accountInformation(account.addr).do();
    for (let i = 0; i < accountInfoResponse['apps-local-state'].length; i++) {
        if (accountInfoResponse['apps-local-state'][i].id == index) {
            console.log("User's local state:");
            for (let n = 0; n < accountInfoResponse['apps-local-state'][i]['key-value'].length; n++) {
                console.log(accountInfoResponse['apps-local-state'][i]['key-value'][n]);
            }
        }
    }
}

// Read global state of application
async function readGlobalState(client, account, index) {
    let accountInfoResponse = await client.accountInformation(account.addr).do();
    for (let i = 0; i < accountInfoResponse['created-apps'].length; i++) {
        if (accountInfoResponse['created-apps'][i].id == index) {
            console.log("Application's global state:");
            for (let n = 0; n < accountInfoResponse['created-apps'][i]['params']['global-state'].length; n++) {
                console.log(accountInfoResponse['created-apps'][i]['params']['global-state'][n]);
            }
        }
    }
}

// #Main Function

async function main() {
    try {
        // Initialize an algodClient
        let algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

        // Get accounts from mnemonic
        let creatorAccount = algosdk.mnemonicToSecretKey(creatorMnemonic);
        let userAccount = algosdk.mnemonicToSecretKey(userMnemonic);

        // Compile programs
        let approvalProgram = await complieProgram(algodClient, approvalProgramSourceRefactored);
        let clearProgram = await complieProgram(algodClient, clearProgramSource);

        // Create new application
        let appId = await createApp(algodClient, creatorAccount, approvalProgram, clearProgram, localInts, localBytes, globalInts, globalBytes);

        let appArgs = [];
        appArgs.push(new Uint8Array(Buffer.from('add'))); //Replace add with minus to subtract... MUST ADD FIRST, can't have negative number

        await callApp(algodClient, userAccount, appId, appArgs);

        await readGlobalState(algodClient, userAccount, appId);

    }
    catch (err) {
        console.log("err", err);
    }
}

module.exports = { default: main};