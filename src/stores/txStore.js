import { action, observable, computed, autorun, toJS } from "mobx";
import Web3Utils from 'web3-utils'
import ERC20ABI from "../abis/ERC20ABI.json"
import MultiSenderAbi from "../abis/StormMultisender.json"
import Web3 from "web3";
import { observer } from "mobx-react";
import swal from 'sweetalert';
const BN = require('bignumber.js');


class TxStore {
  @observable txs = []
  txHashToIndex = {}
  @observable approval = '';
  constructor(rootStore) {
    this.tokenStore = rootStore.tokenStore
    this.web3Store = rootStore.web3Store
    this.gasPriceStore = rootStore.gasPriceStore
    this.interval = null;
  }

  @action
  async reset() {
    this.txs = []
    this.txHashToIndex = {}
    this.approval = '';
    this.keepRunning = false;
    clearInterval(this.interval);
  }

  @action
  async doSend(){
    this.keepRunning = true;
    this.txs = [];
    this.approval = '';
    if(new BN(this.tokenStore.totalBalance === "" ? "0" : this.tokenStore.totalBalance).gt(new BN(this.tokenStore.allowance === "" ? "0" : this.tokenStore.allowance))){
      this._approve();
      const interval = setInterval(() => {
        if(this.approval){
          const index = this.txHashToIndex[this.approval];
          console.log('checking autorun', index, this.approval, this.txHashToIndex, toJS(this.txs))
          if(this.txs[index] && this.txs[index].status === 'mined'){
            clearInterval(interval);
            console.log('lets GO!', this.tokenStore.totalNumberTx, this.tokenStore.arrayLimit)
            setTimeout(() => {
              this._multisend({slice: this.tokenStore.totalNumberTx, addPerTx: this.tokenStore.arrayLimit})
            }, 1000)
          }
        } else {
          console.log('checking autorun', this.txHashToIndex, toJS(this.txs))
        }
      }, 3000)
      this.interval = interval;
    } else {
      this._multisend({slice: this.tokenStore.totalNumberTx, addPerTx: this.tokenStore.arrayLimit})
    }
  }

  @action
  async doApprove(){
    this.keepRunning = true;
    this.txs = [];
    this.approval = '';
    if(new BN(this.tokenStore.totalBalance === "" ? "0" : this.tokenStore.totalBalance).gt(new BN(this.tokenStore.allowance === "" ? "0" : this.tokenStore.allowance))){
      this._approve();
      const interval = setInterval(() => {
        if(this.approval){
          const index = this.txHashToIndex[this.approval];
          console.log('checking autorun', index, this.approval, this.txHashToIndex, toJS(this.txs))
          if(this.txs[index] && this.txs[index].status === 'mined'){
            clearInterval(interval);
            console.log('Approve complete')
          }
        } else {
          console.log('checking autorun', this.txHashToIndex, toJS(this.txs))
        }
      }, 3000)
      this.interval = interval;
    }
  }

  async _approve(){
    const index = this.txs.length;
    const web3 = this.web3Store.web3;
    const token = new web3.eth.Contract(ERC20ABI, this.tokenStore.tokenAddress);
    try{
      return token.methods.approve(await this.tokenStore.proxyMultiSenderAddress(), this.tokenStore.totalBalanceWithDecimals)
      .send({from: this.web3Store.defaultAccount, gasPrice: this.gasPriceStore.standardInHex})
      .once('transactionHash', (hash) => {
        this.approval = hash
        this.txHashToIndex[hash] = index;
        this.txs[index] = {status: 'pending', name: `MultiSender Approval to spend ${this.tokenStore.totalBalance} ${this.tokenStore.tokenSymbol}`, hash}
      })
      .once('receipt', async (receipt) => {
        await this.getTxStatus(receipt.transactionHash)
      })
      .on('error', (error) => {
        swal("Error!", error.message, 'error')
        console.error(error)
      })
    } catch (e){
      console.error(e)
    }

  }

  async getApproveGas(){
    const web3 = this.web3Store.web3;
    const token = new web3.eth.Contract(ERC20ABI, this.tokenStore.tokenAddress);
    let encodedData = await token.methods.approve(await this.tokenStore.proxyMultiSenderAddress(), this.tokenStore.totalBalanceWithDecimals).encodeABI({from: this.web3Store.defaultAccount})
    return web3.eth.estimateGas({
        from: this.web3Store.defaultAccount,
        data: encodedData,
        to: this.tokenStore.tokenAddress,
    })
  }

  async _getTransferGas(to, value){
    const web3 = this.web3Store.web3;
    const { tokenAddress } = this.tokenStore
    if(tokenAddress === "0x000000000000000000000000000000000000bEEF"){
      return web3.eth.estimateGas({
          from: this.web3Store.defaultAccount,
          // data: null,
          value: value,
          to: to
      })
    } else {
      const token = new web3.eth.Contract(ERC20ABI, this.tokenStore.tokenAddress);
      const encodedData = await token.methods.transfer(to, value).encodeABI({from: this.web3Store.defaultAccount})
      return await web3.eth.estimateGas({
          from: this.web3Store.defaultAccount,
          data: encodedData,
          to: this.tokenStore.tokenAddress,
      })
    }
  }

  async getTransferGas() {
    let totalGas = 0
    let { addresses_to_send, balances_to_send } =  this.tokenStore
    for (let i = 0; i < addresses_to_send.length; i++) {
      const to = addresses_to_send[i]
      const value = balances_to_send[i]
      totalGas += await this._getTransferGas(to, value)
    }
    return totalGas
  }

  async getMultisendGas({slice, addPerTx}) {
    let totalGas = 0

    const token_address = this.tokenStore.tokenAddress
    let {addresses_to_send, balances_to_send, currentFee, totalBalance} =  this.tokenStore;

    const start = (slice - 1) * addPerTx;
    const end = slice * addPerTx;
    addresses_to_send = addresses_to_send.slice(start, end);
    balances_to_send = balances_to_send.slice(start, end);
    const totalInWei = balances_to_send.reduce((total, val) => {
      return total.plus(new BN(val));
    }, new BN("0"));
    const balances_to_send_sum = totalInWei.toString(10)
    let ethValue;
    if(token_address === "0x000000000000000000000000000000000000bEEF"){
      const totalInEth = Web3Utils.fromWei(totalInWei.toString())
      ethValue = new BN(currentFee).plus(totalInEth)
    } else {
      ethValue = new BN(currentFee)
    }
    console.log('slice', slice, addresses_to_send[0], balances_to_send[0], addPerTx)
    const web3 = this.web3Store.web3;
    const multisender = new web3.eth.Contract(MultiSenderAbi, await this.tokenStore.proxyMultiSenderAddress());

    if(token_address === "0x000000000000000000000000000000000000bEEF"){
      const encodedData = await multisender.methods.multiTransfer_OST(addresses_to_send, balances_to_send).encodeABI({from: this.web3Store.defaultAccount})
      // console.log("web3.eth.estimateGas:", web3.eth.estimateGas)
      // console.log("web3.eth:", web3.eth)
      const gas = await web3.eth.estimateGas({
          from: this.web3Store.defaultAccount,
          data: encodedData,
          value: Web3Utils.toHex(Web3Utils.toWei(ethValue.toString())),
          to: await this.tokenStore.proxyMultiSenderAddress()
      })
      totalGas += gas
    } else {
      const encodedData = await multisender.methods.multiTransferToken_a4A(token_address, addresses_to_send, balances_to_send, balances_to_send_sum).encodeABI({from: this.web3Store.defaultAccount})
      const gas = await web3.eth.estimateGas({
          from: this.web3Store.defaultAccount,
          data: encodedData,
          value: Web3Utils.toHex(Web3Utils.toWei(ethValue.toString())),
          to: await this.tokenStore.proxyMultiSenderAddress()
      })
      totalGas += gas
    }
    slice--;
    if (slice > 0) {
      totalGas += await this.getMultisendGas({slice, addPerTx});
    }
    return totalGas
  }

  async _multisend({slice, addPerTx}) {
    if(!this.keepRunning){
      return
    }
    const token_address = this.tokenStore.tokenAddress
    let {addresses_to_send, balances_to_send, currentFee, totalBalance} =  this.tokenStore;

    const start = (slice - 1) * addPerTx;
    const end = slice * addPerTx;
    addresses_to_send = addresses_to_send.slice(start, end);
    balances_to_send = balances_to_send.slice(start, end);
    const totalInWei = balances_to_send.reduce((total, val) => {
      return total.plus(new BN(val));
    }, new BN("0"));
    const balances_to_send_sum = totalInWei.toString(10)
    let ethValue;
    if(token_address === "0x000000000000000000000000000000000000bEEF"){
      const totalInEth = Web3Utils.fromWei(totalInWei.toString())
      ethValue = new BN(currentFee).plus(totalInEth)
    } else {
      ethValue = new BN(currentFee)
    }
    console.log('slice', slice, addresses_to_send[0], balances_to_send[0], addPerTx)
    const web3 = this.web3Store.web3;
    const multisender = new web3.eth.Contract(MultiSenderAbi, await this.tokenStore.proxyMultiSenderAddress());

    try {
      if(token_address === "0x000000000000000000000000000000000000bEEF"){
        let encodedData = await multisender.methods.multiTransfer_OST(addresses_to_send, balances_to_send).encodeABI({from: this.web3Store.defaultAccount})
        let gas = await web3.eth.estimateGas({
            from: this.web3Store.defaultAccount,
            data: encodedData,
            value: Web3Utils.toHex(Web3Utils.toWei(ethValue.toString())),
            to: await this.tokenStore.proxyMultiSenderAddress()
        })
        console.log('gas', gas)
        let tx = multisender.methods.multiTransfer_OST(addresses_to_send, balances_to_send)
        .send({
          from: this.web3Store.defaultAccount,
          gasPrice: this.gasPriceStore.standardInHex,
          gas: Web3Utils.toHex(gas),
          value: Web3Utils.toHex(Web3Utils.toWei(ethValue.toString())),
        })

        .once('transactionHash', (hash) => {
          this.txHashToIndex[hash] = this.txs.length
          this.txs.push({status: 'pending', name: `Sending Batch #${this.txs.length} ${this.tokenStore.tokenSymbol}\n
            From ${addresses_to_send[0].substring(0, 7)} to: ${addresses_to_send[addresses_to_send.length-1].substring(0, 7)}
          `, hash})
        })
        .once('receipt', async (receipt) => {
          await this.getTxStatus(receipt.transactionHash)
        })
        .on('error', (error) => {
          swal("Error!", error.message, 'error')
          console.log(error)
          // re-send
          this._multisend({slice, addPerTx});
        })
      } else {
        let encodedData = await multisender.methods.multiTransferToken_a4A(token_address, addresses_to_send, balances_to_send, balances_to_send_sum).encodeABI({from: this.web3Store.defaultAccount})
        let gas = await web3.eth.estimateGas({
            from: this.web3Store.defaultAccount,
            data: encodedData,
            value: Web3Utils.toHex(Web3Utils.toWei(ethValue.toString())),
            to: await this.tokenStore.proxyMultiSenderAddress()
        })
        console.log('gas', gas)
        let tx = multisender.methods.multiTransferToken_a4A(token_address, addresses_to_send, balances_to_send, balances_to_send_sum)
        .send({
          from: this.web3Store.defaultAccount,
          gasPrice: this.gasPriceStore.standardInHex,
          gas: Web3Utils.toHex(gas),
          value: Web3Utils.toHex(Web3Utils.toWei(ethValue.toString())),
        })

        .once('transactionHash', (hash) => {
          this.txHashToIndex[hash] = this.txs.length
          this.txs.push({status: 'pending', name: `Sending Batch #${this.txs.length} ${this.tokenStore.tokenSymbol}\n
            From ${addresses_to_send[0].substring(0, 7)} to: ${addresses_to_send[addresses_to_send.length-1].substring(0, 7)}
          `, hash})
        })
        .once('receipt', async (receipt) => {
          await this.getTxStatus(receipt.transactionHash)
        })
        .on('error', (error) => {
          swal("Error!", error.message, 'error')
          console.log(error)
          // re-send
          this._multisend({slice, addPerTx});
        })
      }
      slice--;
      if (slice > 0) {
        this._multisend({slice, addPerTx});
      }
    } catch(e){
      console.error(e)
    }
  }

  async getTxReceipt(hash){
    console.log('getTxReceipt')
    try {
      const web3 = this.web3Store.web3;
      const res = await web3.eth.getTransaction(hash);
      return res;
    } catch(e) {
      console.error(e);
    }
  }

  async getTxStatus(hash) {
    console.log('GET TX STATUS', hash)
    if(!this.keepRunning){
      return
    }
    const index = this.txHashToIndex[hash]
    const web3 = this.web3Store.web3;

    const txInfo = await web3.eth.getTransaction(hash)
    const receipt = await web3.eth.getTransactionReceipt(hash)
    if (receipt.hasOwnProperty("status")) {
      if (receipt.status === "0x1") {
        this.txs[index].status = `mined`
      } else if (receipt.status === "0x0") {
        // if (receipt.gasUsed > txInfo.gas) {
          this.txs[index].status = `error`
          this.txs[index].name = `Mined but with errors. Perhaps out of gas`
        // } else {
        //   this.txs[index].status = `error`
        //   this.txs[index].name = `Mined but with errors. Perhaps out of gas`
        //   // bad tx status, not confirmed!
        // }
      } else {
        // unknown status. pre-Byzantium
        if (receipt.gasUsed >= txInfo.gas) {
          this.txs[index].status = `error`
          this.txs[index].name = `Mined but with errors. Perhaps out of gas`
        } else {
          this.txs[index].status = `mined`
        }
      }
    } else {
      // unknown status. pre-Byzantium
      if (receipt.gasUsed >= txInfo.gas) {
        this.txs[index].status = `error`
        this.txs[index].name = `Mined but with errors. Perhaps out of gas`
      } else {
        this.txs[index].status = `mined`
      }
    }
  }

  // gas used by the already processed Approve tx
  async getApproveTxGas() {
    if ('' === this.approval) {
      return 0
    }
    const web3 = this.web3Store.web3;
    const receipt = await web3.eth.getTransactionReceipt(this.approval)
    return receipt.gasUsed
  }

}

export default TxStore;
