var StatusError = require("./statuserror");
var Utils = require("./utils");

/*
  Handlers for events emitted by `send` / `call` etc.
 */
var handlers = {

  // ----------------------------------- Constants -------------------------------------------------

  maxConfirmations: 24,          // Maximum number of confirmation web3 emits
  defaultTimeoutBlocks: 50,      // Maximum number of blocks web3 will wait before abandoning tx
  timeoutMessage: '50 blocks',   // Substring of web3 timeout error.

  // -----------------------------------  Helpers --------------------------------------------------

  /**
   * Parses error message and determines if we should squash block timeout errors at user's request.
   * @param  {Object} context execution state
   * @param  {Object} error   error
   * @return {Boolean}
   */
  ignoreTimeoutError: function(context, error){
    var timedOut = error.message && error.message.includes(handlers.timeoutMessage);

    var shouldWait = context.contract &&
                     context.contract.timeoutBlocks &&
                     context.contract.timeoutBlocks > handlers.defaultTimeoutBlocks;

    return timedOut && shouldWait;
  },

  /**
   * Attaches Truffle specific handlers to all of the events emitted by a web3 method.
   * @param {Object}       context  execution state
   * @param {PromiEvent}   emitter  promiEvent returned by a web3 method call
   */
  setup: function(emitter, context){
    emitter.on('error',           handlers.error.bind(emitter, context))
    emitter.on('transactionHash', handlers.hash.bind(emitter, context))
    emitter.on('confirmation',    handlers.confirmation.bind(emitter, context))
    emitter.on('receipt',         handlers.receipt.bind(emitter, context));
  },

  // -----------------------------------  Handlers -------------------------------------------------
  /**
   * Error event handler. Emits error unless error is block timeout and user has
   * specified we should wait longer
   * @param  {Object} context   execution state
   * @param  {Object} error     error
   */
  error: function(context, error){
    if (!handlers.ignoreTimeoutError(context, error)){
      context.promiEvent.eventEmitter.emit('error', error);
      this.removeListener('error', handlers.error);
      context.promiEvent.reject(error); // This shouldn't be necessary!!!
    }
  },

  /**
   * Transaction hash event handler. Attaches the hash to the context object
   * so it can be attached to the contract instance after a deployment resolves.
   * @param  {Object} context   execution state
   * @param  {String} hash      transaction hash
   */
  hash: function(context, hash){
    context.transactionHash = hash;
    context.promiEvent.eventEmitter.emit('transactionHash', hash);
    this.removeListener('transactionHash', handlers.hash);
  },

  confirmation: function(context, number, receipt){
    context.promiEvent.eventEmitter.emit('confirmation', number, receipt)

    // Per web3: initial confirmation index is 0
    if (number === handlers.maxConfirmations + 1) {
      this.removeListener('confirmation', handlers.confirmation);
    }
  },

  /**
   * Receipt event handler. This handler decodes the event logs, re-emits the receipt,
   * and (for method calls only) resolves/rejects the promiEvent with the receipt.
   * @param  {Object} context   execution state
   * @param  {Object} receipt   transaction receipt
   */
  receipt: function(context, receipt){
    // Decode logs
    var logs;

    (receipt.logs)
      ? logs = Utils.decodeLogs.call(context.contract, receipt.logs)
      : logs = [];

    // Emit receipt
    context.promiEvent.eventEmitter.emit('receipt', receipt)

    // .new(): Exit early. We need the promiEvent to resolve a contract instance.
    if(context.onlyEmitReceipt){
      context.receipt = receipt;
      return;
    }

    // .method(): resolve/reject receipt in handler
    if (parseInt(receipt.status) == 0 && !context.onlyEmitReceipt){
      var error = new StatusError(context.params, receipt.transactionHash, receipt);
      error.reason = context.reason;
      return context.promiEvent.reject(error)
    }

    // This object has some duplicate data but is backward compatible.
    context.promiEvent.resolve({
      tx: receipt.transactionHash,
      receipt: receipt,
      logs: logs
    });

    this.removeListener('receipt', handlers.receipt);
  },
}

module.exports = handlers;
