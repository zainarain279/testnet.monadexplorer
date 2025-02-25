const prompts = require("prompts");
const chalk = require("chalk");

console.log(chalk.blueBright(`
░▀▀█░█▀█░▀█▀░█▀█
░▄▀░░█▀█░░█░░█░█
░▀▀▀░▀░▀░▀▀▀░▀░▀
`));

console.log(chalk.greenBright("╔══════════════════════════════════╗"));
console.log(chalk.greenBright("║                                  ║"));
console.log(chalk.yellowBright("║  ZAIN ARAIN                      ║"));
console.log(chalk.yellowBright("║  AUTO SCRIPT MASTER              ║"));
console.log(chalk.greenBright("║                                  ║"));
console.log(chalk.cyanBright("║  JOIN TELEGRAM CHANNEL NOW!      ║"));
console.log(chalk.cyanBright("║  ") + chalk.underline.blue("https://t.me/AirdropScript6") + chalk.cyanBright("      ║"));
console.log(chalk.cyanBright("║  @AirdropScript6 - OFFICIAL      ║"));
console.log(chalk.cyanBright("║  CHANNEL                         ║"));
console.log(chalk.greenBright("║                                  ║"));
console.log(chalk.redBright("║  FAST - RELIABLE - SECURE        ║"));
console.log(chalk.redBright("║  SCRIPTS EXPERT                  ║"));
console.log(chalk.greenBright("║                                  ║"));
console.log(chalk.greenBright("╚══════════════════════════════════╝\n"));

const availableScripts = [
  { title: "Rubics (Swap)", value: "rubic" },
  { title: "Izumi (Swap)", value: "izumi" },
  { title: "Beanswap (Swap)", value: "beanswap" },
  { title: "Magma (Stake)", value: "magma" },
  { title: "Apriori (Stake)", value: "apriori" },
  { title: "Run auto in turn", value: "all" },
  { title: "Exit", value: "exit" },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scriptConfigs = {
  rubic: { cycles: 1, intervalHours: null },
  magma: { cycles: 1, intervalHours: null },
  izumi: { cycles: 1, intervalHours: null },
  apriori: { cycles: 1, intervalHours: null },
  beanswap: { cycles: 1, intervalHours: null }
};

async function runScript(scriptName, automated = false) {
  try {
    let scriptModule;
    
    switch (scriptName) {
      case "rubic":
        console.log("Run Rubics (Swap)...");
        scriptModule = require("./scripts/rubic");
        break;

      case "magma":
        console.log("Run Magma (Stake)...");
        scriptModule = require("./scripts/magma");
        break;

      case "izumi":
        console.log("Run Izumi (Swap)...");
        scriptModule = require("./scripts/izumi");
        break;

      case "apriori":
        console.log("Run Apriori (Stake)...");
        scriptModule = require("./scripts/apriori");
        break;
        
      case "beanswap":
        console.log("Chạy Beanswap (Swap)...");
        scriptModule = require("./scripts/beanswap");
        break;

      default:
        console.log(`Unknown script: ${scriptName}`);
        return;
    }
    
    if (automated && scriptModule.runAutomated) {
      await scriptModule.runAutomated(
        scriptConfigs[scriptName].cycles, 
        scriptConfigs[scriptName].intervalHours
      );
    } else if (automated) {
      console.log(`Warning: ${scriptName} script does not support auto mode.`);
      await scriptModule.run();
    } else {
      await scriptModule.run();
    }
  } catch (error) {
    console.error(`Cannot run ${scriptName} script:`, error.message);
  }
}

async function runAllScriptsSequentially() {
  const scriptOrder = ["rubic", "magma", "izumi", "apriori", "beanswap"];
  
  console.log("-".repeat(60));
  console.log("Currently in auto-run mode");
  console.log("-".repeat(60));
  
  const response = await prompts([
    {
      type: 'number',
      name: 'cycles',
      message: 'How many cycles would you like to run for each script?',
      initial: 1
    },
    {
      type: 'number',
      name: 'intervalHours',
      message: 'Run interval in hours (0 for no repetition):',
      initial: 0
    }
  ]);
  
  for (const script of scriptOrder) {
    scriptConfigs[script].cycles = response.cycles || 1;
    scriptConfigs[script].intervalHours = response.intervalHours > 0 ? response.intervalHours : null;
  }
  
  for (let i = 0; i < scriptOrder.length; i++) {
    const scriptName = scriptOrder[i];
    console.log(`\n[${i + 1}/${scriptOrder.length}] Start running ${scriptName.toUpperCase()}...`);
    
    await runScript(scriptName, true);
    
    if (i < scriptOrder.length - 1) {
      console.log(`\nDone running ${scriptName.toUpperCase()}. Wait 5 seconds before continuing...`);
      await delay(5000);
    } else {
      console.log(`\nDone running ${scriptName.toUpperCase()}.`);
    }
  }
  
  console.log("-".repeat(60));
  console.log("Done running everything, follow Dân Cày Airdrop guys!");
  console.log("-".repeat(60));
}

async function run() {
  const response = await prompts({
    type: "select",
    name: "script",
    message: "Select any to start running:",
    choices: availableScripts,
  });

  const selectedScript = response.script;

  if (!selectedScript) {
    console.log("No script selected. Stop bot...");
    return;
  }

  if (selectedScript === "all") {
    await runAllScriptsSequentially();
  } else if (selectedScript === "exit") {
    console.log("Dừng bot...");
    process.exit(0);
  } else {
    await runScript(selectedScript);
  }
}

run().catch((error) => {
  console.error("Error occurred:", error);
});

module.exports = { runScript, runAllScriptsSequentially };