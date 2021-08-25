import React from 'react';
import { inject, observer } from "mobx-react";
import { Transaction } from "./Transaction"

@inject("UiStore")
@observer
export class FourthStep extends React.Component {
  constructor(props){
    super(props);
    this.txStore = props.UiStore.txStore;
    this.tokenStore = props.UiStore.tokenStore;
    this.explorerUrl = props.UiStore.web3Store.explorerUrl;
    this.intervalId = null
    this.state = {
      txs: this.txStore.txs,
      totalNumberOftx: this.calcTotalNumberOftx(),
    }
    this.doSendExecuted = false

    this.props.addNextHandler(this.onNext)
  }

  onNext = async (wizard) => {
    // console.log(wizard.step)
    if ("multisend" !== wizard.step.id) {
      return
    }

    // reload page to make sure that all caches are cleared
    location.reload()
  }

  componentDidMount(){
    (async () => {
      try {
        if (!this.doSendExecuted) {
          this.doSendExecuted = true
          await this.txStore.doSend()
          this.setState({
            txs: this.txStore.txs,
            totalNumberOftx: this.calcTotalNumberOftx(),
          })
        }
      } catch(e){
        console.log('doApprove error:', e)
      }
    })()
    if (null === this.intervalId) {
      this.intervalId = setInterval(() => {
        this.setState({
          txs: this.txStore.txs,
          totalNumberOftx: this.calcTotalNumberOftx(),
        })
      }, 1000)
    }
  }

  componentWillUnmount() {
    if (null !== this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  calcTotalNumberOftx() {
    let totalNumberOftx;

    // if(Number(this.tokenStore.totalBalance) > Number(this.tokenStore.allowance)){
    //   totalNumberOftx = Number(this.tokenStore.totalNumberTx) + 1;
    // } else {
      totalNumberOftx = Number(this.tokenStore.totalNumberTx)
    // }
    return totalNumberOftx
  }

  render () {
    const { txs, totalNumberOftx } = this.state
    const txHashes = txs.map((tx, index) => {
      return <Transaction key={index} tx={{...tx}} explorerUrl={this.explorerUrl}/>
    })
    const mined = txs.reduce((mined, tx) => {
      const { status } = tx
      return mined && status === "mined"
    }, true)
    let status;
    if(txs.length === totalNumberOftx){
      if (mined) {
        status =  "All transactions are mined. Congratulations!"
      } else {
        status =  "Transactions were sent out. Now wait until all transactions are mined."
      }
    } else {
      const txCount = totalNumberOftx - txs.length
      status = `Waiting for you to sign transaction in Metamask`
      if (totalNumberOftx > 1) {
        status = `Waiting for you to sign ${txCount} transactions in Metamask`
      }
    }
    let label = "Sign a multisend transaction in MetaMask"
    if (totalNumberOftx > 1) {
      label = `Sign all ${totalNumberOftx} multisend transactions in MetaMask`
    }
    let label2 = "to send tokens to many recipients from the Multisend smart contract"
    if ("ETH" === this.tokenStore.tokenSymbol) {
      label2 = "to send ETH to many recipients from the Multisend smart contract"
    }
    return (
      <div>
        <div>
          <div className="description">
            <div>
              {label}<br />{label2}
            </div>
            <p>&nbsp;</p>
            <ol>
              <li>Confirm all multisend transactions in MetaMask</li>
              <li>Wait for all transactions to be mined</li>
              <li>Check transactions on etherscan</li>
              <li>Press the <strong>Next</strong> button</li>
            </ol>
          </div>
          <form className="form">
            <p>{status}</p>
            <div className="table">
              {txHashes}
            </div>
          </form>
        </div>
      </div>
    );
  }
}
