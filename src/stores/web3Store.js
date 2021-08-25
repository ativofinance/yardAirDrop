import { action, observable } from "mobx";
import getWeb3 from '../getWeb3';
import Web3 from 'web3';

class Web3Store {
  @observable web3 = {};
  @observable defaultAccount = '';
  @observable loading = true;
  @observable errors = [];
  @observable userTokens = [];
  @observable explorerUrl = '';
  @observable startedUrl = window.location.hash
  constructor(rootStore) {
    this.userTokensInitialized = false
  }
  @action
  setExplorerUrl(url) {
    this.explorerUrl = url
  }
  @action
  setStartedUrl(url) {
    this.startedUrl = url;
  }

  async getWeb3Promise() {
    return getWeb3().then(async (web3Config) => {
      if ('' !== this.explorerUrl) {
        return this
      }
      const { web3Instance, defaultAccount, netId, netIdName } = web3Config;
      this.defaultAccount = defaultAccount;
      // this.web3 = new Web3(web3Instance.currentProvider);
      this.web3 = web3Instance;
      this.netId = netId;
      this.netIdName = netIdName;
      await this.getUserTokens(web3Config)
      this.setExplorerUrl(web3Config.explorerUrl)
      console.log('web3 loaded')
      return this
    }).catch((e) => {
      console.error(e, 'web3 not loaded')
      this.errors.push(e.message)
      throw e
    })
  }

  async getUserTokens({ trustApiName, defaultAccount }) {
    return new Promise((resolve, reject) => {
      if (this.userTokensInitialized) {
        resolve(this)
        return
      }


      const blockchain_network = this.netIdName.toLowerCase()
      let api_suffix = '';
      let api_domain = '';
      let etherscanApiKey = '';
      if (('mainnet' === blockchain_network) || ('matic' === blockchain_network)) {
        api_suffix = '';
      } else {
        api_suffix = '-' + blockchain_network
      }

      if (('mumbai' === blockchain_network) || ('matic' === blockchain_network)) {
        api_domain = "polygonscan.com";
        etherscanApiKey = process.env["REACT_APP_PROXY_MULTISENDER_POLYSCAN_API_KEY"]
      } else {
        api_domain = "etherscan.io";
        etherscanApiKey = process.env["REACT_APP_PROXY_MULTISENDER_ETHERSCAN_API_KEY"]
      }

      window.fetch(
        `https://api${api_suffix}.${api_domain}/api?module=account&action=tokentx&address=${defaultAccount}&startblock=0&endblock=999999999&sort=desc&apikey=${etherscanApiKey}`
      ).then((res) => {
        return res.json()
      }).then((res) => {
        if (!(res.result && (typeof res.result === "object") && res.result.hasOwnProperty("length"))) {
          this.loading = false;
          reject("Failed to load user tokens. Try again a minute later please.")
          return
        }
        let tokens = res.result.filter(tx => {
          if (!tx.hasOwnProperty("to") || tx["to"].toLowerCase() != defaultAccount.toLowerCase()) {
            return false
          }
          if (!tx.hasOwnProperty("contractAddress")) {
            return false
          }
          if (!tx.hasOwnProperty("tokenName")) {
            return false
          }
          if (!tx.hasOwnProperty("tokenSymbol")) {
            return false
          }
          if (!tx.hasOwnProperty("tokenDecimal")) {
            return false
          }
          return true
        }).map(tx => {
          const tokenAddress = tx["contractAddress"];
          const tokenName = tx["tokenName"];
          const tokenSymbol = tx["tokenSymbol"];
          const tokenDecimal = tx["tokenDecimal"];
          return { label: `${tokenSymbol} - ${tokenAddress}`, value: tokenAddress, tokenSymbol }
        })
        let tokensUniqueObj = {}
        for (let i = 0; i < tokens.length; i++) {
          let token = tokens[i]
          tokensUniqueObj[token.value] = token
        }
        let tokensUnique = Object.keys(tokensUniqueObj).map(tokenAddress => tokensUniqueObj[tokenAddress])


        if (('mumbai' === blockchain_network) || ('matic' === blockchain_network)) {
          tokensUnique.unshift({
            value: '0x000000000000000000000000000000000000bEEF',
            label: "MATIC - Polygon Native Currency"
          })
        } else {
          tokensUnique.unshift({
            value: '0x000000000000000000000000000000000000bEEF',
            label: "ETH - Ethereum Native Currency"
          })
        }
        this.userTokens = tokensUnique;
        this.userTokensInitialized = true
        this.loading = false;
        resolve(this)
      }).catch((e) => {
        this.loading = false;
        console.error(e);
        reject(e)
      })
    })
  }
}

export default Web3Store;
