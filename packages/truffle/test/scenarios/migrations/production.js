const MemoryLogger = require("../memorylogger");
const CommandRunner = require("../commandrunner");
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const Server = require("../server");
const Reporter = require("../reporter");
const sandbox = require("../sandbox");
const Web3 = require('web3');

const log = console.log;

const util = require('util');

function processErr(err, output){
  if (err){
    log(output);
    throw new Error(err);
  }
}

describe("production migrations [ @geth ]", function() {
  if (!process.env.GETH) return;

  let config;
  let web3;
  let networkId;
  const project = path.join(__dirname, '../../sources/migrations/production');
  const logger = new MemoryLogger();

  before(done => Server.start(done));
  after(done => Server.stop(done));

  before(async function() {
    this.timeout(10000);
    config = await sandbox.create(project)
    config.network = "ropsten";
    config.logger = logger;
    config.mocha = {
      reporter: new Reporter(logger)
    }

    const provider = new Web3.providers.HttpProvider('http://localhost:8545')
    web3 = new Web3(provider);
    networkId = await web3.eth.net.getId();
  });

  it("runs migrations (sync & async/await)", function(done) {
    this.timeout(70000);

    CommandRunner.run("migrate --network ropsten", config, err => {

      const output = logger.contents();
      processErr(err, output);

      assert(output.includes('2_migrations_conf.js'));
      assert(output.includes("Deploying 'Example'"))

      const location = path.join(config.contracts_build_directory, "Example.json");
      const artifact = require(location);
      const network = artifact.networks[networkId];

      assert(output.includes(network.transactionHash));
      assert(output.includes(network.address));
      assert(output.includes('2 confirmations'));
      assert(output.includes('confirmation number: 1'));
      assert(output.includes('confirmation number: 2'));

      console.log(output)
      done();
    })
  });
});