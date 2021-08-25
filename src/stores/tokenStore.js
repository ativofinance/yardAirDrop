import { action, observable, computed } from "mobx";
import ERC20ABI from '../abis/ERC20ABI.json'
// import StormMultiSenderABI from '../abis/StormMultisender.json'
import Web3Utils from 'web3-utils';

const BN = require('bignumber.js');
function add(a, b) {
  return new BN(a).plus(new BN(b));
}
class TokenStore {
  @observable decimals = '';
  @observable jsonAddresses = [];
  @observable tokenAddress = '';
  @observable defAccTokenBalance = ''
  @observable allowance = ''
  @observable currentFee = '0'
  @observable tokenSymbol = ''
  @observable ethBalance = ''
  @observable balances_to_send = []
  @observable addresses_to_send = []
  @observable invalid_addresses = []
  @observable filteredAddresses = []
  @observable totalBalance = '0'
  @observable arrayLimit = 0
  @observable errors = []
  @observable dublicates = []

  constructor(rootStore) {
    this.web3Store = rootStore.web3Store;
    this.gasPriceStore = rootStore.gasPriceStore;

  }

  async proxyMultiSenderAddress() {
    try {
      const web3Obj = await this.web3Store.getWeb3Promise()
      const netIdEnvVarName = "REACT_APP_PROXY_MULTISENDER_" + web3Obj.netIdName.toUpperCase()
      const contractAddress = process.env[netIdEnvVarName]
      return contractAddress;
    } catch (ex) {
      console.log(ex)
    }
    return ""
  }

  @action
  async getDecimals(address) {
    if ('' !== this.decimals) {
      return this.decimals
    }
    try{
      const web3 = this.web3Store.web3;
      const token = new web3.eth.Contract(ERC20ABI, address);
      this.decimals = await token.methods.decimals().call();
      return this.decimals
    } catch(e) {
      this.errors.push('Cannot get decimals for token contract.\n Please make sure you are on the right network and token address exists')
      console.error('Get Decimals', e)
    }
  }

  async getBalance() {
    if ('' !== this.defAccTokenBalance) {
      return this.defAccTokenBalance
    }
    try {
        const web3 = this.web3Store.web3;
        const token = new web3.eth.Contract(ERC20ABI, this.tokenAddress);
        const defAccTokenBalance = await token.methods.balanceOf(this.web3Store.defaultAccount).call();
        this.defAccTokenBalance = new BN(defAccTokenBalance).div(this.multiplier).toString(10)
        web3.eth.subscribe("newBlockHeaders", async (err, result) => {
          if (err) {
            console.log(err);
            return
          }
          const defAccTokenBalance = await token.methods.balanceOf(this.web3Store.defaultAccount).call();
          this.defAccTokenBalance = new BN(defAccTokenBalance).div(this.multiplier).toString(10)
        })
        return this.defAccTokenBalance
    }
    catch(e){
      this.errors.push(`${this.web3Store.defaultAccount} doesn't have token balance.\n Please make sure you are on the right network and token address exists`)
      console.error('getBalance',e)
    }
  }
  async getEthBalance() {
    if ('' !== this.ethBalance) {
      return this.ethBalance
    }
    try {
      const web3 = this.web3Store.web3;
      let ethBalance =  await web3.eth.getBalance(this.web3Store.defaultAccount)
      ethBalance = Web3Utils.fromWei(ethBalance)
      this.ethBalance = new BN(ethBalance).toFormat(3)
      web3.eth.subscribe("newBlockHeaders", async (err, result) => {
        if (err) {
          console.log(err);
          return
        }
        let ethBalance =  await web3.eth.getBalance(this.web3Store.defaultAccount)
        ethBalance = Web3Utils.fromWei(ethBalance)
        this.ethBalance = new BN(ethBalance).toFormat(3)
      })
      return this.ethBalance
    }
    catch(e){
      console.error(e)
    }
  }
  async getTokenSymbol(tokenAddress) {
    if ('' !== this.tokenSymbol) {
      return this.tokenSymbol
    }
    try {
      const web3 = this.web3Store.web3;
      const token = new web3.eth.Contract(ERC20ABI, tokenAddress);
      this.tokenSymbol = await token.methods.symbol().call();
      return this.tokenSymbol
    }
    catch(e){
      this.errors.push('Token with this Address doesnt exist.\n Please make sure you are on the right network and token address exists')
      console.error(e)
    }
  }
  @action
  async getAllowance() {
    if ('' !== this.allowance) {
      return this.allowance
    }
    try {
      const web3 = this.web3Store.web3;
      const token = new web3.eth.Contract(ERC20ABI, this.tokenAddress);
      const allowance = await token.methods.allowance(this.web3Store.defaultAccount, await this.proxyMultiSenderAddress()).call();
      this.allowance = new BN(allowance).div(this.multiplier).toString(10)
      web3.eth.subscribe("newBlockHeaders", async (err, result) => {
        if (err) {
          console.log(err);
          return
        }
        const allowance = await token.methods.allowance(this.web3Store.defaultAccount, await this.proxyMultiSenderAddress()).call();
        this.allowance = new BN(allowance).div(this.multiplier).toString(10)
      })
      return this.allowance
    }
    catch(e){
      this.errors.push(`Token address doesn't have allowance method.\n Please make sure you are on the right network and token address exists.\n
         Your account: ${this.web3Store.defaultAccount}`)
      console.error('GetAllowance',e)
    }
  }

  @action
  async getCurrentFee(){
    // const currentFee = "100000000000000"; // 0.0001 ETH
    // this.currentFee = Web3Utils.fromWei(currentFee)
    return this.currentFee
    // try {
    //   this.web3Store.getWeb3Promise().then(async () => {
    //     const web3 = this.web3Store.web3;
    //     const multisender = new web3.eth.Contract(StormMultiSenderABI, await this.proxyMultiSenderAddress());
    //     const currentFee = await multisender.methods.currentFee(this.web3Store.defaultAccount).call();
    //     this.currentFee = Web3Utils.fromWei(currentFee)
    //     return this.currentFee
    //   })
    // }
    // catch(e){
    //   console.error('getCurrentFee',e)
    // }
  }

  setCurrentFee(currentFee){
    this.currentFee = Web3Utils.fromWei(currentFee)
  }

  async getArrayLimit(){
    this.arrayLimit = 200;
    // this.arrayLimit = 1;
    return this.arrayLimit
    // try {
    //   await this.web3Store.getWeb3Promise().then(async () => {
    //     const web3 = this.web3Store.web3;
    //     const multisender = new web3.eth.Contract(StormMultiSenderABI, await this.proxyMultiSenderAddress());
    //     await multisender.methods.arrayLimit().call();
    //     return this.arrayLimit
    //   })
    // }
    // catch(e){
    //   console.error('GetArrayLimit', e)
    // }
  }

  @action
  async setTokenAddress(tokenAddress) {
    await this.web3Store.getWeb3Promise()
    await this.getCurrentFee()
    await this.getEthBalance()
    await this.getArrayLimit()
    this.decimals = '';
    this.defAccTokenBalance = ''
    this.allowance = ''
    this.tokenSymbol = ''
    if(Web3Utils.isAddress(this.web3Store.defaultAccount) && tokenAddress !== "0x000000000000000000000000000000000000bEEF"){
      this.tokenAddress = tokenAddress;
      await this.getDecimals(tokenAddress)
      await this.getBalance()
      await this.getAllowance()
      await this.getTokenSymbol(tokenAddress)
    } else {
      this.tokenAddress = tokenAddress;
      this.tokenSymbol = "ETH"
      this.decimals = 18;
      this.defAccTokenBalance = this.ethBalance;
    }
  }

  @action
  setDecimals(decimals) {
    this.decimals = decimals;
  }

  @action
  setJsonAddresses(addresses){
    this.jsonAddresses = addresses;
  }

  @action
  async reset(){
    this.decimals = '';
    this.jsonAddresses = [];
    this.tokenAddress = '';
    this.defAccTokenBalance = ''
    this.allowance = ''
    this.currentFee = '0'
    this.tokenSymbol = ''
    this.ethBalance = ''
    this.balances_to_send = []
    this.addresses_to_send = []
    this.invalid_addresses = []
    this.filteredAddresses = []
    this.totalBalance = '0'
    this.arrayLimit = 0
    this.errors = []
    this.dublicates = []
  }

  @action
  async parseAddresses(){
    this.addresses_to_send = []
    this.dublicates = []
    this.totalBalance = 0;
    this.invalid_addresses = [];
    this.balances_to_send = [];
    return new Promise((res, rej) => {
      try {
        this.jsonAddresses.forEach((account, index) => {
          if(Object.keys(account).length === 0){
            rej({message: `There was an error parsing ${JSON.stringify(account)} at line ${index}`})
          }
          let address = Object.keys(account)[0].replace(/\s/g, "").replace("0X", "0x")
          address = Web3Utils.toChecksumAddress(address)
          if(!Web3Utils.isAddress(address)){
            this.invalid_addresses.push(address);
          } else {
            let balance = Object.values(account)[0];
            this.totalBalance = new BN(balance).plus(this.totalBalance).toString(10)
            // console.log('balance,', balance)
            balance = this.multiplier.times(balance);
            const indexAddr = this.addresses_to_send.indexOf(address);
            if(indexAddr === -1){
              this.addresses_to_send.push(address);
              this.balances_to_send.push(balance.toString(10))
            } else {
              if(this.dublicates.indexOf(address) === -1){
                this.dublicates.push(address);
              }
              this.balances_to_send[indexAddr] = (new BN(this.balances_to_send[indexAddr]).plus(balance)).toString(10)
            }
          }
        })

        this.jsonAddresses = this.addresses_to_send.map((addr, index) => {
          let obj = {}
          obj[addr] = (new BN(this.balances_to_send[index]).div(this.multiplier)).toString(10)
          return obj;
        })
        res(this.jsonAddresses)
        if(this.tokenAddress === "0x000000000000000000000000000000000000bEEF") {
          this.allowance = this.totalBalance
        }
      } catch(e){
        rej(e)
      }
    })
  }

  @computed get totalBalanceWithDecimals() {
    return new BN(this.totalBalance).times(this.multiplier).toString(10)
  }
  @computed get multiplier(){
    const decimals = Number(this.decimals)
    return new BN(10).pow(decimals)
  }

  @computed get totalNumberTx() {
    return Math.ceil(this.jsonAddresses.length/this.arrayLimit);
  }

  @computed get addressesData() {
    return this.jsonAddresses.map((account) => {
      const address = Object.keys(account)[0].replace(/\s/g, "");;
      const balance = Object.values(account)[0];
      return {address, balance}
    })
  }

  // @computed get totalCostInEth(){
  //   const standardGasPrice = Web3Utils.toWei(this.gasPriceStore.selectedGasPrice.toString(), 'gwei');
  //   const currentFeeInWei = Web3Utils.toWei(this.currentFee);
  //   const tx = new BN(standardGasPrice).times(new BN('5000000'))
  //   const txFeeMiners = tx.times(new BN(this.totalNumberTx))
  //   const contractFee = new BN(currentFeeInWei).times(this.totalNumberTx);
  //
  //   return Web3Utils.fromWei(txFeeMiners.plus(contractFee).toString(10))
  // }

}

export default TokenStore;
