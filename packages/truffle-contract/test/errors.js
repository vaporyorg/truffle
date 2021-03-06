var assert = require("chai").assert;
var util = require('./util');

describe("Client appends errors (vmErrorsOnRPCResponse)", function() {
  var Example;
  var accounts;
  var network_id;
  var web3;
  var providerOptions = {vmErrorsOnRPCResponse: true}; // <--- TRUE

  before(function() {
    this.timeout(10000);

    Example = util.createExample();

    return util
      .setUpProvider(Example, providerOptions)
      .then(result => {
        web3 = result.web3;
        accounts = result.accounts;
      });
  });

  describe(".new(): errors", function(){
    it("should reject on OOG", async function(){
      try {
        await Example.new(1, {gas: 10});
        assert.fail();
      } catch(error) {
        assert(error.message.includes('exceeds gas limit'), 'Should OOG');
      }
    });

    it("should emit OOG errors", function(done){
      Example
        .new(1, {gas: 10})
        .on('error', error => {
          assert(error.message.includes('exceeds gas limit'), 'Should OOG');
          done();
        })
        .catch(err => null);
    });

    it("should error w/gas limit error if constructor reverts", async function(){
      try {
        await Example.new(13) // 13 fails a constructor require gate
        assert.fail()
      } catch(e){
        assert(!e.reason, 'Error should not include reason string');
        assert(e.message.includes('exceeds gas limit'), 'Error should be gas limit err');
      }
    });

    it("should error w/reason string if constructor reverts", async function(){
      try {
        await Example.new(2001) // 2001 fails a constructor require gate w/ a reason
        assert.fail()
      } catch(e){
        assert(e.reason === 'reasonstring', 'Error should include reason string');
        assert(e.message.includes('exceeds gas limit'), 'Error should be gas limit err');
      }
    });

    // NB: constructor (?) message is unhelpful:
    // "Error: Invalid number of parameters for "undefined". Got 2 expected 1!""
    it("should reject with web3 validation errors (constructor params)", async function(){
      try {
        await Example.new(25, 25);
        assert.fail();
      } catch (e){
        assert(e.message.includes("Invalid number of parameters"), "web3 should validate");
      }
    });
  });

  describe(".method(): errors", function(){
    // NB: call always takes +1 param: defaultBlock
    it('should validate method arguments for .calls', async function(){
      const example = await Example.new(5);
      try {
        await example.getValue('apples', 'oranges', 'pineapples');
        assert.fail();
      } catch(e){
        assert(e.message.includes('parameters'), 'should error on invalid params');
      }
    });

    it('should validate method arguments for .sends', async function(){
      const example = await Example.new(5);
      try {
        await example.setValue(5, 5);
        assert.fail();
      } catch(e){
        assert(e.message.includes('parameters'), 'should error on invalid params');
      }
    });

    it("should reject on OOG", async function(){
      const example = await Example.new(1);
      try {
        await example.setValue(10, {gas: 10});
        assert.fail();
      } catch(e){
        assert(e.message.includes('exceeds gas limit'), 'Error should be OOG');
      }
    });

    it("should emit OOG errors", function(done){
      Example.new(1).then(example => {
        example
          .setValue(10, {gas: 10})
          .on('error', e => {
            assert(e.message.includes('exceeds gas limit'), 'Error should be OOG');
            done();
          })
          .catch(e => null);
      });
    });

    it("errors with revert message", async function(){
      const example = await Example.new(1)
      try {
        await example.triggerRequireError();
        assert.fail();
      } catch(e){
        assert(!e.reason, 'Should not include reasonstring');
        assert(e.message.includes('revert'), 'Should include revert message');
      };
    });

    it("errors with reason string on revert", async function(){
      const example = await Example.new(1)
      try {
        await example.triggerRequireWithReasonError();
        assert.fail();
      } catch(e){
        assert(e.reason === 'reasonstring', 'Should include reasonstring');
        assert(e.message.includes('revert'), 'Should include revert message');
      };
    });

    it("errors with reason string on revert (gas specified)", async function(){
      const example = await Example.new(1)
      try {
        await example.triggerRequireWithReasonError({gas: 200000});
        assert.fail();
      } catch(e){
        assert(e.reason === 'reasonstring', 'Should include reason string');
        assert(e.message.includes('revert'), 'Should include revert');
      }
    });

    it("errors with invalid opcode when gas specified", async function(){
      const example = await Example.new(1)
      try {
        await example.triggerAssertError({gas: 200000});
        assert.fail();
      } catch(e){
        assert(!e.reason, 'Should not include reason string');
        assert(e.message.includes('invalid opcode'), 'Should include invalid opcode');
      }
    });

    it("errors with invalid opcode when gas not specified", async function(){
      const example = await Example.new(1)
      try {
        await example.triggerAssertError();
        assert.fail();
      } catch(e){
        assert(e.message.includes('invalid opcode'));
      }
    });

    // NB: this error is different than the `invalid` opcode error
    // produced when the vmErrors flag is on.
    it("errors with OOG on internal OOG", async function(){
      this.timeout(5000);

      const example = await Example.new(1)
      try {
        await example.runsOutOfGas();
        assert.fail();
      } catch(e){
        assert(e.message.includes('out of gas'));
      }
    });
  });
});