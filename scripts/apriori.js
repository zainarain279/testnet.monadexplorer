const ethers = require("ethers");
const colors = require("colors");
const readline = require("readline");
const axios = require("axios");
const fs = require("fs");

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contractAddress = "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A";
const gasLimitStake = 500000;
const gasLimitUnstake = 800000;
const gasLimitClaim = 800000;

const minimalABI = [
  "function getPendingUnstakeRequests(address) view returns (uint256[] memory)",
];

function readPrivateKeys() {
  try {
    const data = fs.readFileSync('wallet.txt', 'utf8');
    const privateKeys = data.split('\n')
      .map(key => key.trim())
      .filter(key => key.length > 0);
    
    console.log(`Find ${privateKeys.length} wallet in wallet.txt`.green);
    return privateKeys;
  } catch (error) {
    console.error("❌ Unable to read file wallet.txt:".red, error.message);
    process.exit(1);
  }
}

async function getRandomAmount(wallet) {
  try {
    const balance = await provider.getBalance(wallet.address);
    const min = balance.mul(1).div(100); // 1% of balance
    const max = balance.mul(5).div(100); // 5% of balance
    
    if (min.lt(ethers.utils.parseEther("0.0001"))) {
      console.log("Balance too low, use minimum amount".yellow);
      return ethers.utils.parseEther("0.0001");
    }
    
    const range = max.sub(min);
    const randomBigNumber = ethers.BigNumber.from(
      ethers.utils.randomBytes(32)
    ).mod(range);
    
    const randomAmount = min.add(randomBigNumber);
    
    return randomAmount;
  } catch (error) {
    console.error("❌ Error calculating random amount:".red, error.message);
    return ethers.utils.parseEther("0.01");
  }
}

function getRandomDelay() {
  const minDelay = 30 * 1000;
  const maxDelay = 1 * 60 * 1000;
  return Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stakeMON(wallet, cycleNumber) {
  try {
    console.log(`\n[Cycle ${cycleNumber}] start staking MON...`.magenta);
    console.log(`Wallet: ${wallet.address}`.cyan);

    const stakeAmount = await getRandomAmount(wallet);
    console.log(
      `Random number of stakes: ${ethers.utils.formatEther(stakeAmount)} MON (1-5% balance)`
    );

    const data =
      "0x6e553f65" +
      ethers.utils.hexZeroPad(stakeAmount.toHexString(), 32).slice(2) +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2);

    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: ethers.utils.hexlify(gasLimitStake),
      value: stakeAmount,
    };

    console.log("🔄 Submit a stake request...");
    const txResponse = await wallet.sendTransaction(tx);
    console.log(
      `➡️  Transaction sent: ${EXPLORER_URL}${txResponse.hash}`.yellow
    );

    console.log("Waiting for transaction confirmation...");
    const receipt = await txResponse.wait();
    console.log(`✔️ Stake success!`.green.underline);

    return { receipt, stakeAmount };
  } catch (error) {
    console.error("❌ Stake failed:".red, error.message);
    throw error;
  }
}

async function requestUnstakeAprMON(wallet, amountToUnstake, cycleNumber) {
  try {
    console.log(
      `\n[Cycle ${cycleNumber}] prepare to unstake aprMON...`.magenta
    );
    console.log(`Wallet: ${wallet.address}`.cyan);
    console.log(
      `Quantity unstake: ${ethers.utils.formatEther(
        amountToUnstake
      )} aprMON`
    );

    const data =
      "0x7d41c86e" +
      ethers.utils.hexZeroPad(amountToUnstake.toHexString(), 32).slice(2) +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2) +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2);

    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: ethers.utils.hexlify(gasLimitUnstake),
      value: ethers.utils.parseEther("0"),
    };

    console.log("🔄 Submit request unstake...");
    const txResponse = await wallet.sendTransaction(tx);
    console.log(
      `➡️  Transaction sent: ${EXPLORER_URL}${txResponse.hash}`.yellow
    );

    console.log("🔄 Waiting for transaction confirmation...");
    const receipt = await txResponse.wait();
    console.log(`✔️  Unstake successfully!`.green.underline);

    return receipt;
  } catch (error) {
    console.error("❌ Unstake failed:".red, error.message);
    throw error;
  }
}

async function checkClaimableStatus(walletAddress) {
  try {
    const apiUrl = `https://stake-api.apr.io/withdrawal_requests?address=${walletAddress}`;
    const response = await axios.get(apiUrl);

    const claimableRequest = response.data.find(
      (request) => !request.claimed && request.is_claimable
    );

    if (claimableRequest) {
      console.log(`Found claimable request ID: ${claimableRequest.id}`);
      return {
        id: claimableRequest.id,
        isClaimable: true,
      };
    }
    return {
      id: null,
      isClaimable: false,
    };
  } catch (error) {
    console.error(
      "❌ Error:".red,
      error.message
    );
    return {
      id: null,
      isClaimable: false,
    };
  }
}

async function claimMON(wallet, cycleNumber) {
  try {
    console.log(`\n[Cycle ${cycleNumber}] Check the number of Mon received back...`);
    console.log(`Wallet: ${wallet.address}`.cyan);

    const { id, isClaimable } = await checkClaimableStatus(wallet.address);

    if (!isClaimable || !id) {
      console.log("No withdrawal requests found at this time");
      return null;
    }

    console.log(`Withdrawal request with ID: ${id}`);

    const data =
      "0x492e47d2" +
      "0000000000000000000000000000000000000000000000000000000000000040" +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2) +
      "0000000000000000000000000000000000000000000000000000000000000001" +
      ethers.utils
        .hexZeroPad(ethers.BigNumber.from(id).toHexString(), 32)
        .slice(2);

    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: ethers.utils.hexlify(gasLimitClaim),
      value: ethers.utils.parseEther("0"),
    };

    console.log("Create transaction...");
    const txResponse = await wallet.sendTransaction(tx);
    console.log(`Transaction sent: ${EXPLORER_URL}${txResponse.hash}`);

    console.log("Waiting for transaction confirmation...");
    const receipt = await txResponse.wait();
    console.log(`Claim successful with ID: ${id}`.green.underline);

    return receipt;
  } catch (error) {
    console.error("Claim failure:", error.message);
    throw error;
  }
}

async function runCycle(wallet, cycleNumber) {
  try {
    console.log(`\n=== Start the cycle ${cycleNumber} / ${wallet.address} ===`);

    const { stakeAmount } = await stakeMON(wallet, cycleNumber);

    const delayTimeBeforeUnstake = getRandomDelay();
    console.log(
      `🔄 Waiting ${
        delayTimeBeforeUnstake / 1000
      } seconds before unstake request...`
    );
    await delay(delayTimeBeforeUnstake);

    await requestUnstakeAprMON(wallet, stakeAmount, cycleNumber);

    console.log(
      `Wait 660 seconds (11 minutes) before checking claim status...`
        .magenta
    );
    await delay(660000);

    await claimMON(wallet, cycleNumber);

    console.log(
      `=== Period ${cycleNumber} for wallet ${wallet.address} done! ===`.magenta.bold
    );
  } catch (error) {
    console.error(`❌ Period ${cycleNumber} failure:`.red, error.message);
    throw error;
  }
}

async function processAccount(privateKey, cycleCount) {
  try {
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }
    
    const wallet = new ethers.Wallet(privateKey, provider);
    const shortAddress = `${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`;
    console.log(`\n=== Processing account ${shortAddress} ===`.cyan.bold);

    const initialBalance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.utils.formatEther(initialBalance)} MON`.yellow);

    for (let i = 1; i <= cycleCount; i++) {
      await runCycle(wallet, i);

      if (i < cycleCount) {
        const interCycleDelay = getRandomDelay();
        console.log(
          `\nChờ ${interCycleDelay / 1000} seconds before next cycle...`
        );
        await delay(interCycleDelay);
      }
    }

    const finalBalance = await provider.getBalance(wallet.address);
    console.log(`\nFinal balance: ${ethers.utils.formatEther(finalBalance)} MON`.yellow);
    
    const difference = finalBalance.sub(initialBalance);
    if (difference.gt(0)) {
      console.log(`Profit: +${ethers.utils.formatEther(difference)} MON`.green);
    } else {
      console.log(`Loss: ${ethers.utils.formatEther(difference)} MON`.red);
    }

    console.log(`=== Wallet processing completed ${shortAddress} ===`.cyan.bold);
    return true;
  } catch (error) {
    console.error(`❌ Account processing failed:`.red, error.message);
    return false;
  }
}

async function processAllAccounts(cycleCount, intervalHours) {
  try {
    const privateKeys = readPrivateKeys();
    if (privateKeys.length === 0) {
      console.error("Privatekey not found in wallet.txt".red);
      return false;
    }

    console.log(`📋 Find ${privateKeys.length} wallet in wallet.txt`.cyan);
    console.log(`Run ${cycleCount} cycle for each account...`.yellow);

    for (let i = 0; i < privateKeys.length; i++) {
      console.log(`\n🔄 Processing account ${i + 1} / ${privateKeys.length}`.cyan);
      const success = await processAccount(privateKeys[i], cycleCount);
      
      if (!success) {
        console.log(`⚠️ Unable to process account ${i + 1}, moving on to next account`.yellow);
      }
      
      if (i < privateKeys.length - 1) {
        console.log("\nSwitch to next account after 3 seconds...".cyan);
        await delay(3000);
      }
    }

    console.log(
      `\n✅ All ${privateKeys.length} Account processed successfully!`.green.bold
    );
    
    if (intervalHours) {
      console.log(`\n⏱️ All accounts processed. Next batch will run later. ${intervalHours} hour`.cyan);
      setTimeout(() => processAllAccounts(cycleCount, intervalHours), intervalHours * 60 * 60 * 1000);
    }
    
    return true;
  } catch (error) {
    console.error("❌ Operation failed:".red, error.message);
    return false;
  }
}

function run() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("How many cycles do you want to run per account? ", (answer) => {
    const cycleCount = parseInt(answer);
    
    if (isNaN(cycleCount) || cycleCount <= 0) {
      console.error("Please enter a valid number!".red);
      rl.close();
      process.exit(1);
    }
    
    rl.question(
      "How often do you want the cycle to run (in hours)? (Press enter to run now): ",
      (hours) => {
        let intervalHours = hours ? parseInt(hours) : null;
        
        if (hours && (isNaN(intervalHours) || intervalHours < 0)) {
          console.error("Please enter a valid number!".red);
          rl.close();
          process.exit(1);
        }
        processAllAccounts(cycleCount, intervalHours);
        rl.close();
      }
    );
  });
}

async function runAutomated(cycles = 1, intervalHours = null) {
  await processAllAccounts(cycles, intervalHours);
  return true;
}

module.exports = { 
  run, 
  runAutomated,
  stakeMON,
  requestUnstakeAprMON,
  claimMON,
  getRandomAmount,
  getRandomDelay,
};

if (require.main === module) {
  run();
}